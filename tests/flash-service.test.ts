import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { FirmwareStore } from '../electron/main/services/firmware-store';
import { PortCoordinator } from '../electron/main/services/port-coordinator';
import { FlashService, type FlashBinaryFn } from '../electron/main/services/flash-service';
import type { FlashDone, FlashProgress, RebootDownloadResult } from '../shared/ipc';
import { SOFT_ENTRY_ACK, SOFT_ENTRY_COMMAND } from '../shared/protocol';

async function firmwareFixture() {
  const root = await mkdtemp(join(tmpdir(), 'mk-flash-'));
  const dir = join(root, 'v1.0.0');
  await mkdir(dir);
  const bin = Buffer.from('fake-firmware-image');
  const sha = createHash('sha256').update(bin).digest('hex');
  await writeFile(join(dir, 'meowkit-s3-v1.0.0-factory.bin'), bin);
  await writeFile(join(dir, 'SHA256SUMS.txt'), `${sha}  meowkit-s3-v1.0.0-factory.bin\n`);
  return { root, sha, binPath: join(dir, 'meowkit-s3-v1.0.0-factory.bin') };
}

function createSerial(opts?: { connected?: boolean; ack?: string | null }) {
  const connected = opts?.connected ?? false;
  const write = vi.fn(async () => undefined);
  const readLine = vi.fn(async () => opts?.ack ?? null);
  const disconnect = vi.fn(async () => undefined);
  return {
    disconnect,
    write,
    readLine,
    asTransport: () => ({
      isConnected: () => connected,
      write,
      readLine,
    }),
  };
}

function createService(opts: {
  root: string;
  serial?: ReturnType<typeof createSerial>;
  flashBinary?: FlashBinaryFn;
  coordinator?: PortCoordinator;
}) {
  const coordinator = opts.coordinator ?? new PortCoordinator();
  const store = new FirmwareStore(opts.root);
  const serial = opts.serial ?? createSerial();
  const flashBinary = opts.flashBinary ?? (async () => undefined);
  const service = new FlashService(coordinator, store, serial, flashBinary);
  const progress: FlashProgress[] = [];
  const logs: string[] = [];
  const done: FlashDone[] = [];
  service.onProgress((p) => progress.push(p));
  service.onLog((line) => logs.push(line));
  service.onDone((d) => done.push(d));
  return { coordinator, store, serial, service, progress, logs, done };
}

describe('FlashService', () => {
  it('prepareSoftEntry returns not-connected when serial is down', async () => {
    const { root } = await firmwareFixture();
    const { service, serial } = createService({ root, serial: createSerial({ connected: false }) });

    const result: RebootDownloadResult = await service.prepareSoftEntry();

    expect(result).toEqual({ ok: false, reason: 'not-connected' });
    expect(serial.write).not.toHaveBeenCalled();
  });

  it('prepareSoftEntry reboots via transport when serial is connected', async () => {
    const { root } = await firmwareFixture();
    const serial = createSerial({ connected: true, ack: SOFT_ENTRY_ACK });
    const { service } = createService({ root, serial });

    await expect(service.prepareSoftEntry()).resolves.toEqual({ ok: true });
    expect(serial.write).toHaveBeenCalledWith(SOFT_ENTRY_COMMAND);
  });

  it('preempts serial, verifies bundled image, emits progress then done', async () => {
    const { root, binPath } = await firmwareFixture();
    const coordinator = new PortCoordinator();
    coordinator.requestSerial();
    const serial = createSerial({ connected: true });
    const flashBinary = vi.fn<FlashBinaryFn>(async ({ onProgress, onLog, portPath, erase, imagePath }) => {
      expect(portPath).toBe('COM3');
      expect(erase).toBe(false);
      expect(imagePath).toBe(binPath);
      onLog('writing');
      onProgress({ percent: 50, bytesWritten: 10 });
      onProgress({ percent: 100, bytesWritten: 20 });
    });
    const { service, progress, done, logs } = createService({
      root,
      coordinator,
      serial,
      flashBinary,
    });

    await service.executeFlash({ imageId: 'bundled:v1.0.0', erase: false, portPath: 'COM3' });

    expect(serial.disconnect).toHaveBeenCalledOnce();
    expect(flashBinary).toHaveBeenCalledOnce();
    expect(progress).toEqual([
      { percent: 50, bytesWritten: 10 },
      { percent: 100, bytesWritten: 20 },
    ]);
    expect(logs).toContain('writing');
    expect(done).toEqual([{ ok: true }]);
    expect(coordinator.getMode()).toBe('idle');
  });

  it('blocks start if checksum fails', async () => {
    const { root, binPath } = await firmwareFixture();
    await writeFile(binPath, Buffer.from('tampered'));
    const flashBinary = vi.fn<FlashBinaryFn>(async () => undefined);
    const { service, done, coordinator } = createService({ root, flashBinary });

    await expect(
      service.executeFlash({ imageId: 'bundled:v1.0.0', erase: false, portPath: 'COM3' }),
    ).rejects.toThrow(/checksum/i);

    expect(flashBinary).not.toHaveBeenCalled();
    expect(done).toEqual([expect.objectContaining({ ok: false })]);
    expect(coordinator.getMode()).toBe('idle');
  });

  it('cancel sets aborted and emits done ok:false', async () => {
    const { root } = await firmwareFixture();
    let releaseHang: (() => void) | undefined;
    const flashBinary = vi.fn<FlashBinaryFn>(async ({ signal }) => {
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
        releaseHang = resolve;
      });
    });
    const { service, done } = createService({ root, flashBinary });

    const flashing = service.executeFlash({
      imageId: 'bundled:v1.0.0',
      erase: true,
      portPath: 'COM9',
    });
    await vi.waitFor(() => expect(flashBinary).toHaveBeenCalledOnce());

    service.cancel();
    await flashing;

    expect(flashBinary.mock.calls[0][0].signal.aborted).toBe(true);
    expect(done).toEqual([expect.objectContaining({ ok: false })]);
    releaseHang?.();
  });

  it('rejects a second concurrent executeFlash while already flashing', async () => {
    const { root } = await firmwareFixture();
    let releaseHang: (() => void) | undefined;
    const flashBinary = vi.fn<FlashBinaryFn>(async () => {
      await new Promise<void>((resolve) => {
        releaseHang = resolve;
      });
    });
    const { service, done } = createService({ root, flashBinary });

    const first = service.executeFlash({
      imageId: 'bundled:v1.0.0',
      erase: false,
      portPath: 'COM3',
    });
    await vi.waitFor(() => expect(flashBinary).toHaveBeenCalledOnce());

    await expect(
      service.executeFlash({ imageId: 'bundled:v1.0.0', erase: false, portPath: 'COM3' }),
    ).rejects.toThrow('Flash already in progress');
    expect(flashBinary).toHaveBeenCalledOnce();
    expect(done).toEqual([]);

    releaseHang?.();
    await first;
    expect(done).toEqual([{ ok: true }]);
  });
});
