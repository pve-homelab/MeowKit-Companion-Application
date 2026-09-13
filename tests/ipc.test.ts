import { describe, expect, it, vi } from 'vitest';
import { IpcChannels, type FirmwareImage, type PortMode } from '../shared/ipc';
import { PortCoordinator } from '../electron/main/services/port-coordinator';
import { registerIpc } from '../electron/main/ipc';

function createHarness() {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
  const sent: Array<{ channel: string; payload: unknown }> = [];
  const coordinator = new PortCoordinator();

  const serial = {
    listPorts: vi.fn(async () => [
      { path: 'COM3', friendlyName: 'USB JTAG/serial debug unit', vendorId: '303A', productId: '1001' },
      { path: 'COM4', friendlyName: 'USB Serial Device' },
    ]),
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    onData: vi.fn((cb: (chunk: string) => void) => {
      serial.emitData = cb;
      return () => undefined;
    }),
    onStatus: vi.fn((cb: (status: { state: 'disconnected' }) => void) => {
      serial.emitStatus = cb;
      return () => undefined;
    }),
    asTransport: vi.fn(() => ({
      isConnected: () => false,
      write: async () => undefined,
      readLine: async () => null,
    })),
    emitData: undefined as ((chunk: string) => void) | undefined,
    emitStatus: undefined as ((status: { state: 'disconnected' }) => void) | undefined,
  };

  const flash = {
    executeFlash: vi.fn(async () => undefined),
    cancel: vi.fn(),
    onProgress: vi.fn((cb: (p: { percent: number }) => void) => {
      flash.emitProgress = cb;
      return () => undefined;
    }),
    onLog: vi.fn((cb: (line: string) => void) => {
      flash.emitLog = cb;
      return () => undefined;
    }),
    onDone: vi.fn((cb: (done: { ok: boolean }) => void) => {
      flash.emitDone = cb;
      return () => undefined;
    }),
    emitProgress: undefined as ((p: { percent: number }) => void) | undefined,
    emitLog: undefined as ((line: string) => void) | undefined,
    emitDone: undefined as ((done: { ok: boolean }) => void) | undefined,
  };

  const customImage: FirmwareImage = {
    id: 'custom:C:/fw.bin',
    label: 'fw.bin',
    path: 'C:/fw.bin',
    source: 'custom',
  };
  const store = {
    list: vi.fn(async () => [] as FirmwareImage[]),
    addCustom: vi.fn(async () => customImage),
  };
  const pickFirmwareFile = vi.fn(async () => 'C:/fw.bin' as string | null);

  registerIpc({
    ipc: {
      handle(channel, listener) {
        handlers.set(channel, listener);
      },
    },
    send: (channel, payload) => sent.push({ channel, payload }),
    coordinator,
    serial,
    flash,
    store,
    pickFirmwareFile,
  });

  async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`missing handler: ${channel}`);
    return (await handler({}, ...args)) as T;
  }

  return { handlers, sent, coordinator, serial, flash, store, pickFirmwareFile, invoke };
}

describe('registerIpc', () => {
  it('registers invoke handlers for every request channel', () => {
    const { handlers } = createHarness();
    expect([...handlers.keys()].sort()).toEqual(
      [
        IpcChannels.serialListPorts,
        IpcChannels.serialConnect,
        IpcChannels.serialDisconnect,
        IpcChannels.serialWrite,
        IpcChannels.flashGetImages,
        IpcChannels.flashPickCustom,
        IpcChannels.flashStart,
        IpcChannels.flashCancel,
        IpcChannels.deviceRebootDownload,
        IpcChannels.appGetPortMode,
      ].sort(),
    );
  });

  it('lists serial ports through SerialService', async () => {
    const { invoke } = createHarness();
    const ports = await invoke<Array<{ path: string }>>(IpcChannels.serialListPorts);
    expect(ports[0]?.path).toBe('COM3');
  });

  it('connects, writes, and disconnects serial', async () => {
    const { invoke, serial } = createHarness();
    await invoke(IpcChannels.serialConnect, { path: 'COM4', baudRate: 115200 });
    await invoke(IpcChannels.serialWrite, 'hello');
    await invoke(IpcChannels.serialDisconnect);
    expect(serial.connect).toHaveBeenCalledWith({ path: 'COM4', baudRate: 115200 });
    expect(serial.write).toHaveBeenCalledWith('hello');
    expect(serial.disconnect).toHaveBeenCalledOnce();
  });

  it('returns firmware images and custom pick results', async () => {
    const { invoke, store, pickFirmwareFile } = createHarness();
    store.list.mockResolvedValueOnce([{ id: 'bundled:v1.0.0', label: 'factory', path: '/b.bin', source: 'bundled' }]);
    await expect(invoke(IpcChannels.flashGetImages)).resolves.toEqual([
      { id: 'bundled:v1.0.0', label: 'factory', path: '/b.bin', source: 'bundled' },
    ]);
    await expect(invoke(IpcChannels.flashPickCustom)).resolves.toMatchObject({ path: 'C:/fw.bin', source: 'custom' });
    expect(store.addCustom).toHaveBeenCalledWith('C:/fw.bin');

    pickFirmwareFile.mockResolvedValueOnce(null);
    await expect(invoke(IpcChannels.flashPickCustom)).resolves.toBeNull();
  });

  it('starts flash with explicit portPath', async () => {
    const { invoke, flash } = createHarness();
    await invoke(IpcChannels.flashStart, { imageId: 'bundled:v1.0.0', erase: false, portPath: 'COM9' });
    expect(flash.executeFlash).toHaveBeenCalledWith({
      imageId: 'bundled:v1.0.0',
      erase: false,
      portPath: 'COM9',
    });
  });

  it('prefers the USB JTAG port when flash.start omits portPath', async () => {
    const { invoke, flash } = createHarness();
    await invoke(IpcChannels.flashStart, { imageId: 'bundled:v1.0.0', erase: true });
    expect(flash.executeFlash).toHaveBeenCalledWith({
      imageId: 'bundled:v1.0.0',
      erase: true,
      portPath: 'COM3',
    });
  });

  it('rejects flash.start when portPath is omitted and no JTAG port exists', async () => {
    const { invoke, serial } = createHarness();
    serial.listPorts.mockResolvedValueOnce([{ path: 'COM4', friendlyName: 'USB Serial Device' }]);
    await expect(invoke(IpcChannels.flashStart, { path: 'C:/x.bin', erase: false })).rejects.toThrow(/jtag/i);
  });

  it('cancels flash and reports port mode', async () => {
    const { invoke, flash, coordinator } = createHarness();
    coordinator.requestSerial();
    await invoke(IpcChannels.flashCancel);
    expect(flash.cancel).toHaveBeenCalledOnce();
    await expect(invoke<PortMode>(IpcChannels.appGetPortMode)).resolves.toBe('serial');
  });

  it('reboots to download mode via serial transport', async () => {
    const { invoke, serial } = createHarness();
    await expect(invoke(IpcChannels.deviceRebootDownload)).resolves.toEqual({
      ok: false,
      reason: 'not-connected',
    });
    expect(serial.asTransport).toHaveBeenCalled();
  });

  it('forwards serial, flash, and port-mode events to the renderer', () => {
    const { sent, serial, flash, coordinator } = createHarness();
    serial.emitData?.('chunk');
    serial.emitStatus?.({ state: 'disconnected' });
    flash.emitProgress?.({ percent: 40 });
    flash.emitLog?.('writing');
    flash.emitDone?.({ ok: true });
    coordinator.requestFlashing();

    expect(sent).toEqual(
      expect.arrayContaining([
        { channel: IpcChannels.serialData, payload: 'chunk' },
        { channel: IpcChannels.serialStatus, payload: { state: 'disconnected' } },
        { channel: IpcChannels.flashProgress, payload: { percent: 40 } },
        { channel: IpcChannels.flashLog, payload: 'writing' },
        { channel: IpcChannels.flashDone, payload: { ok: true } },
        { channel: IpcChannels.appPortMode, payload: 'flashing' },
      ]),
    );
  });
});
