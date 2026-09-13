import { describe, expect, it } from 'vitest';
import type { MeowKitBridge } from '../src/meowkit';
import type { SerialPortInfo, SerialStatus } from '../shared/ipc';
import { createDeviceManagerController, portsToDevices } from '../src/views/deviceManager';

function stubSerial(overrides: Partial<MeowKitBridge['serial']> = {}): MeowKitBridge['serial'] {
  return {
    listPorts: async () => [],
    connect: async () => undefined,
    disconnect: async () => undefined,
    write: async () => undefined,
    onData: () => () => undefined,
    onStatus: () => () => undefined,
    ...overrides,
  };
}

describe('portsToDevices', () => {
  it('marks the connected path as connected and others disconnected', () => {
    const ports: SerialPortInfo[] = [
      { path: 'COM3', friendlyName: 'MeowKit CDC' },
      { path: 'COM4', friendlyName: 'Other' },
    ];
    expect(portsToDevices(ports, 'COM3')).toEqual([
      { id: 'COM3', name: 'MeowKit CDC', status: 'connected' },
      { id: 'COM4', name: 'Other', status: 'disconnected' },
    ]);
  });

  it('treats a missing connected path as all disconnected', () => {
    expect(portsToDevices([{ path: 'COM3', friendlyName: 'MeowKit CDC' }])).toEqual([
      { id: 'COM3', name: 'MeowKit CDC', status: 'disconnected' },
    ]);
  });
});

describe('createDeviceManagerController', () => {
  it('lists ports, connects at 115200, disconnects, and tracks the connected path', async () => {
    const ports: SerialPortInfo[] = [
      { path: 'COM3', friendlyName: 'MeowKit CDC' },
      { path: 'COM4', friendlyName: 'Other' },
    ];
    let statusCb: ((status: SerialStatus) => void) | undefined;
    const connects: Array<{ path: string; baudRate: number }> = [];
    let disconnects = 0;

    const serial = stubSerial({
      listPorts: async () => ports,
      connect: async (opts) => {
        connects.push(opts);
      },
      disconnect: async () => {
        disconnects += 1;
      },
      onStatus: (cb) => {
        statusCb = cb;
        return () => {
          statusCb = undefined;
        };
      },
    });

    const controller = createDeviceManagerController(serial, () => undefined);

    await controller.refresh();
    expect(controller.getState().devices).toEqual([
      { id: 'COM3', name: 'MeowKit CDC', status: 'disconnected' },
      { id: 'COM4', name: 'Other', status: 'disconnected' },
    ]);

    controller.select('COM3');
    await controller.connect();
    expect(connects).toEqual([{ path: 'COM3', baudRate: 115200 }]);

    statusCb?.({ state: 'connected', path: 'COM3', baudRate: 115200 });
    expect(controller.getState().devices.find((d) => d.id === 'COM3')?.status).toBe('connected');
    expect(controller.getState().selectedId).toBe('COM3');

    await controller.disconnect();
    expect(disconnects).toBe(1);
    statusCb?.({ state: 'disconnected' });
    expect(controller.getState().devices.every((d) => d.status === 'disconnected')).toBe(true);

    controller.dispose();
    expect(statusCb).toBeUndefined();
  });
});
