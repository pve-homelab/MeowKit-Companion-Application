import { describe, expect, it } from 'vitest';
import type { MeowKitBridge } from '../src/meowkit';
import type { SerialPortInfo, SerialStatus } from '../shared/ipc';
import {
  SERIAL_BAUD,
  createSerialConsoleController,
  encodeSerialWrite,
  lineFromData,
  lineFromStatus,
  portsToSelectOptions,
} from '../src/views/serialConsole';

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

describe('serial console mapping', () => {
  it('uses 115200 as the connect baud rate', () => {
    expect(SERIAL_BAUD).toBe(115200);
  });

  it('maps ports to Select options by path and friendlyName', () => {
    const ports: SerialPortInfo[] = [
      { path: 'COM3', friendlyName: 'MeowKit CDC' },
      { path: 'COM4', friendlyName: 'COM4' },
    ];
    expect(portsToSelectOptions(ports)).toEqual([
      { value: 'COM3', label: 'MeowKit CDC' },
      { value: 'COM4', label: 'COM4' },
    ]);
  });

  it('maps onData chunks to stdout lines with incrementing string ids', () => {
    expect(lineFromData('1', 'hello')).toEqual({ id: '1', text: 'hello', stream: 'stdout' });
    expect(lineFromData('2', 'world')).toEqual({ id: '2', text: 'world', stream: 'stdout' });
  });

  it('maps reconnecting status to a system line', () => {
    const status: SerialStatus = { state: 'reconnecting', path: 'COM3', attempt: 2 };
    expect(lineFromStatus('3', status)).toEqual({
      id: '3',
      text: 'Reconnecting to COM3 (attempt 2)',
      stream: 'system',
    });
  });

  it('appends a newline when encoding a send payload', () => {
    expect(encodeSerialWrite('ping')).toBe('ping\n');
  });
});

describe('createSerialConsoleController', () => {
  it('refreshes ports, connects at 115200, writes line+newline, and pipes data/status into lines', async () => {
    const ports: SerialPortInfo[] = [{ path: 'COM3', friendlyName: 'MeowKit CDC' }];
    let dataCb: ((chunk: string) => void) | undefined;
    let statusCb: ((status: SerialStatus) => void) | undefined;
    const connects: Array<{ path: string; baudRate: number }> = [];
    const writes: string[] = [];

    const serial = stubSerial({
      listPorts: async () => ports,
      connect: async (opts) => {
        connects.push(opts);
      },
      write: async (data) => {
        writes.push(data);
      },
      onData: (cb) => {
        dataCb = cb;
        return () => {
          dataCb = undefined;
        };
      },
      onStatus: (cb) => {
        statusCb = cb;
        return () => {
          statusCb = undefined;
        };
      },
    });

    const snapshots: unknown[] = [];
    const controller = createSerialConsoleController(serial, (state) => {
      snapshots.push(state);
    });

    await controller.refresh();
    await controller.connect('COM3');
    await controller.send('ping');
    dataCb?.('hello');
    statusCb?.({ state: 'connected', path: 'COM3', baudRate: 115200 });
    statusCb?.({ state: 'reconnecting', path: 'COM3', attempt: 1 });

    expect(connects).toEqual([{ path: 'COM3', baudRate: 115200 }]);
    expect(writes).toEqual(['ping\n']);
    expect(controller.getState().ports).toEqual(ports);
    expect(controller.getState().connected).toBe(false);
    expect(controller.getState().selectedPath).toBe('COM3');
    expect(controller.getState().lines).toEqual([
      { id: '1', text: 'hello', stream: 'stdout' },
      { id: '2', text: 'Reconnecting to COM3 (attempt 1)', stream: 'system' },
    ]);

    controller.dispose();
    expect(dataCb).toBeUndefined();
    expect(statusCb).toBeUndefined();
    expect(snapshots.length).toBeGreaterThan(0);
  });
});
