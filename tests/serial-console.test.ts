import { describe, expect, it } from 'vitest';
import type { MeowKitBridge } from '../src/meowkit';
import type { SerialPortInfo, SerialStatus } from '../shared/ipc';
import {
  SERIAL_BAUD,
  SERIAL_BAUD_RATES,
  baudRatesToSelectOptions,
  createSerialConsoleController,
  encodeSerialWrite,
  formatSerialLog,
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
    reset: async () => undefined,
    saveLog: async () => true,
    onData: () => () => undefined,
    onStatus: () => () => undefined,
    getStatus: async () => ({ state: 'disconnected' as const }),
    ...overrides,
  };
}

describe('serial console mapping', () => {
  it('uses 115200 as the default baud rate', () => {
    expect(SERIAL_BAUD).toBe(115200);
    expect(SERIAL_BAUD_RATES).toEqual([115200, 921600, 9600]);
    expect(baudRatesToSelectOptions()).toEqual([
      { value: '115200', label: '115200' },
      { value: '921600', label: '921600' },
      { value: '9600', label: '9600' },
    ]);
  });

  it('formats console lines into a log payload', () => {
    expect(formatSerialLog([{ id: '1', text: 'boot\n', stream: 'stdout' }])).toBe('boot\n');
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

  it('hydrates connected path from getStatus on refresh', async () => {
    const ports: SerialPortInfo[] = [{ path: 'COM3', friendlyName: 'MeowKit CDC' }];
    const serial = stubSerial({
      listPorts: async () => ports,
      getStatus: async () => ({ state: 'connected', path: 'COM3', baudRate: 115200 }),
    });
    const controller = createSerialConsoleController(serial, () => undefined);
    await controller.refresh();
    expect(controller.getState().ports).toEqual(ports);
    expect(controller.getState().connected).toBe(true);
    expect(controller.getState().selectedPath).toBe('COM3');
    controller.dispose();
  });

  it('reconnects when baud rate changes while connected', async () => {
    const connects: Array<{ path: string; baudRate: number }> = [];
    let statusCb: ((status: SerialStatus) => void) | undefined;
    const serial = stubSerial({
      connect: async (opts) => {
        connects.push(opts);
        statusCb?.({ state: 'connected', path: opts.path, baudRate: opts.baudRate });
      },
      onStatus: (cb) => {
        statusCb = cb;
        return () => {
          statusCb = undefined;
        };
      },
      getStatus: async () => ({ state: 'connected', path: 'COM3', baudRate: 115200 }),
      listPorts: async () => [{ path: 'COM3', friendlyName: 'MeowKit CDC' }],
    });
    const controller = createSerialConsoleController(serial, () => undefined);
    await controller.refresh();
    await controller.setBaudRate(921600);
    expect(connects).toEqual([{ path: 'COM3', baudRate: 921600 }]);
    controller.dispose();
  });

  it('saveLog forwards formatted lines to serial.saveLog', async () => {
    const saved: string[] = [];
    const serial = stubSerial({
      saveLog: async (content) => {
        saved.push(content);
        return true;
      },
    });
    const controller = createSerialConsoleController(serial, () => undefined);
    controller.getState().lines.push({ id: '1', text: 'hello\n', stream: 'stdout' });
    await controller.saveLog();
    expect(saved).toEqual(['hello\n']);
    controller.dispose();
  });

  it('reset calls serial.reset and surfaces errors as system lines', async () => {
    let resets = 0;
    const serial = stubSerial({
      reset: async () => {
        resets += 1;
        throw new Error('DTR failed');
      },
    });
    const lines: unknown[] = [];
    const controller = createSerialConsoleController(serial, (state) => {
      lines.push(state.lines.at(-1));
    });
    await expect(controller.reset()).rejects.toThrow('DTR failed');
    expect(resets).toBe(1);
    expect(lines.at(-1)).toEqual({ id: '1', text: 'DTR failed', stream: 'system' });
    controller.dispose();
  });

  it('disconnect calls serial.disconnect', async () => {
    let disconnects = 0;
    let statusCb: ((status: SerialStatus) => void) | undefined;
    const serial = stubSerial({
      disconnect: async () => {
        disconnects += 1;
        statusCb?.({ state: 'disconnected' });
      },
      onStatus: (cb) => {
        statusCb = cb;
        return () => {
          statusCb = undefined;
        };
      },
      getStatus: async () => ({ state: 'connected', path: 'COM3', baudRate: 115200 }),
      listPorts: async () => [{ path: 'COM3', friendlyName: 'MeowKit CDC' }],
    });
    const controller = createSerialConsoleController(serial, () => undefined);
    await controller.refresh();
    await controller.disconnect();
    expect(disconnects).toBe(1);
    expect(controller.getState().connected).toBe(false);
    controller.dispose();
  });
});
