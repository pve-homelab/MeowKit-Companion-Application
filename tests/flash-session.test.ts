import { describe, expect, it } from 'vitest';
import type { MeowKitBridge } from '../src/meowkit';
import type { FirmwareImage, FlashDone, FlashProgress, SerialPortInfo } from '../shared/ipc';
import {
  FLASH_SUCCESS_COPY,
  SAFE_RETRY_COPY,
  createFlashSessionController,
  pickFlashPortPath,
  preferJtagPort,
} from '../src/views/flashSession';

const bundled: FirmwareImage = {
  id: 'bundled:v1.0.0',
  label: 'MeowKit v1.0.0',
  version: '1.0.0',
  path: 'resources/firmware/v1.0.0/meowkit-s3-v1.0.0-factory.bin',
  source: 'bundled',
};

const jtagPort: SerialPortInfo = {
  path: 'COM3',
  friendlyName: 'USB JTAG/serial debug unit',
  vendorId: '303A',
  productId: '1001',
};

const cdcPort: SerialPortInfo = { path: 'COM4', friendlyName: 'USB Serial Device' };

function stubBridge(overrides: {
  serial?: Partial<MeowKitBridge['serial']>;
  flash?: Partial<MeowKitBridge['flash']>;
  device?: Partial<MeowKitBridge['device']>;
} = {}): Pick<MeowKitBridge, 'serial' | 'flash' | 'device'> {
  return {
    serial: {
      listPorts: async () => [],
      connect: async () => undefined,
      disconnect: async () => undefined,
      write: async () => undefined,
      onData: () => () => undefined,
      onStatus: () => () => undefined,
      ...overrides.serial,
    },
    flash: {
      getImages: async () => [],
      pickCustomImage: async () => null,
      start: async () => undefined,
      cancel: async () => undefined,
      onProgress: () => () => undefined,
      onLog: () => () => undefined,
      onDone: () => () => undefined,
      ...overrides.flash,
    },
    device: {
      rebootToDownloadMode: async () => ({ ok: true }),
      ...overrides.device,
    },
  };
}

describe('JTAG port preference', () => {
  it('prefers the USB JTAG/serial debug unit friendlyName', () => {
    const ports = [cdcPort, jtagPort];
    expect(preferJtagPort(ports)).toEqual(jtagPort);
    expect(pickFlashPortPath(ports)).toBe('COM3');
  });

  it('keeps an explicit selected path when it is still present', () => {
    expect(pickFlashPortPath([cdcPort, jtagPort], 'COM4')).toBe('COM4');
  });
});

describe('createFlashSessionController', () => {
  it('loads images via getImages and selects the first image', async () => {
    const bridge = stubBridge({
      flash: { getImages: async () => [bundled] },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.loadImages();
    expect(controller.getState().images).toEqual([bundled]);
    expect(controller.getState().selectedImageId).toBe('bundled:v1.0.0');
    controller.dispose();
  });

  it('lists ports on connect and prefers the JTAG name', async () => {
    const bridge = stubBridge({
      serial: { listPorts: async () => [cdcPort, jtagPort] },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.connect();
    expect(controller.getState().ports).toEqual([cdcPort, jtagPort]);
    expect(controller.getState().selectedPortPath).toBe('COM3');
    expect(controller.getState().deviceName).toBe('USB JTAG/serial debug unit');
    controller.dispose();
  });

  it('reboots then starts flash when soft-entry succeeds', async () => {
    const starts: unknown[] = [];
    const bridge = stubBridge({
      serial: { listPorts: async () => [jtagPort] },
      flash: {
        getImages: async () => [bundled],
        start: async (opts) => {
          starts.push(opts);
        },
      },
      device: { rebootToDownloadMode: async () => ({ ok: true }) },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.loadImages();
    await controller.flash();
    expect(starts).toEqual([{ imageId: 'bundled:v1.0.0', erase: false, portPath: 'COM3' }]);
    expect(controller.getState().showBootGuide).toBe(false);
    expect(controller.getState().status).toBe('busy');
    controller.dispose();
  });

  it('shows the BOOT guide when reboot is unsupported', async () => {
    let started = false;
    const bridge = stubBridge({
      flash: {
        getImages: async () => [bundled],
        start: async () => {
          started = true;
        },
      },
      device: { rebootToDownloadMode: async () => ({ ok: false, reason: 'unsupported' }) },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.loadImages();
    await controller.flash();
    expect(started).toBe(false);
    expect(controller.getState().showBootGuide).toBe(true);
    expect(controller.getState().status).toBe('idle');
    controller.dispose();
  });

  it('shows the BOOT guide when reboot is not-connected', async () => {
    const bridge = stubBridge({
      flash: { getImages: async () => [bundled] },
      device: { rebootToDownloadMode: async () => ({ ok: false, reason: 'not-connected' }) },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.loadImages();
    await controller.flash();
    expect(controller.getState().showBootGuide).toBe(true);
    controller.dispose();
  });

  it('picks the JTAG port and starts after BOOT confirm', async () => {
    const starts: unknown[] = [];
    const bridge = stubBridge({
      serial: { listPorts: async () => [cdcPort, jtagPort] },
      flash: {
        getImages: async () => [bundled],
        start: async (opts) => {
          starts.push(opts);
        },
      },
      device: { rebootToDownloadMode: async () => ({ ok: false, reason: 'unsupported' }) },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.loadImages();
    await controller.flash();
    controller.setConfirmErase(true);
    await controller.confirmBoot();
    expect(starts).toEqual([{ imageId: 'bundled:v1.0.0', erase: true, portPath: 'COM3' }]);
    expect(controller.getState().showBootGuide).toBe(false);
    expect(controller.getState().selectedPortPath).toBe('COM3');
    controller.dispose();
  });

  it('passes the erase checkbox through to flash.start', async () => {
    const starts: unknown[] = [];
    const bridge = stubBridge({
      serial: { listPorts: async () => [jtagPort] },
      flash: {
        getImages: async () => [bundled],
        start: async (opts) => {
          starts.push(opts);
        },
      },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.loadImages();
    controller.setConfirmErase(true);
    await controller.flash();
    expect(starts[0]).toMatchObject({ erase: true });
    controller.dispose();
  });

  it('streams progress and logs, then success or safe-retry copy', async () => {
    let progressCb: ((p: FlashProgress) => void) | undefined;
    let logCb: ((line: string) => void) | undefined;
    let doneCb: ((done: FlashDone) => void) | undefined;
    const bridge = stubBridge({
      serial: { listPorts: async () => [jtagPort] },
      flash: {
        getImages: async () => [bundled],
        onProgress: (cb) => {
          progressCb = cb;
          return () => {
            progressCb = undefined;
          };
        },
        onLog: (cb) => {
          logCb = cb;
          return () => {
            logCb = undefined;
          };
        },
        onDone: (cb) => {
          doneCb = cb;
          return () => {
            doneCb = undefined;
          };
        },
      },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.loadImages();
    await controller.flash();
    progressCb?.({ percent: 40, bytesWritten: 1024 });
    logCb?.('Detected ESP32-S3');
    expect(controller.getState().progress).toBe(40);
    expect(controller.getState().logs).toEqual(['Detected ESP32-S3']);

    doneCb?.({ ok: true });
    expect(controller.getState().status).toBe('success');
    expect(controller.getState().errorMessage).toBeUndefined();
    expect(controller.getState().resultMessage).toBe(FLASH_SUCCESS_COPY);

    doneCb?.({ ok: false, error: 'timed out' });
    expect(controller.getState().status).toBe('error');
    expect(controller.getState().errorMessage).toBe(SAFE_RETRY_COPY);
    expect(controller.getState().logs.at(-1)).toBe('timed out');
    expect(SAFE_RETRY_COPY).toMatch(/not permanently damaged/i);
    expect(SAFE_RETRY_COPY).toMatch(/BOOT/i);

    controller.dispose();
    expect(progressCb).toBeUndefined();
    expect(logCb).toBeUndefined();
    expect(doneCb).toBeUndefined();
  });

  it('cancel calls flash.cancel', async () => {
    let cancelled = 0;
    const bridge = stubBridge({
      flash: {
        cancel: async () => {
          cancelled += 1;
        },
      },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.cancel();
    expect(cancelled).toBe(1);
    controller.dispose();
  });

  it('errors after BOOT confirm when no JTAG port is available', async () => {
    const bridge = stubBridge({
      serial: { listPorts: async () => [cdcPort] },
      flash: { getImages: async () => [bundled] },
    });
    const controller = createFlashSessionController(bridge, () => undefined);
    await controller.loadImages();
    await controller.confirmBoot();
    expect(controller.getState().status).toBe('error');
    expect(controller.getState().errorMessage).toMatch(/USB JTAG\/serial debug unit/i);
    controller.dispose();
  });
});
