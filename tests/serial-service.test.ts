import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortCoordinator } from '../electron/main/services/port-coordinator';
import {
  SerialService,
  type SerialPortFactory,
  type SerialPortLike,
} from '../electron/main/services/serial-service';
import type { SerialStatus } from '../shared/ipc';

class MockPort implements SerialPortLike {
  handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  isOpen = false;
  writes: Array<Buffer | string> = [];

  async open(): Promise<void> {
    this.isOpen = true;
  }

  async close(): Promise<void> {
    this.isOpen = false;
    this.emit('close');
  }

  write(buf: Buffer | string, cb: (err?: Error | null) => void): void {
    this.writes.push(buf);
    cb(null);
  }

  on(ev: string, cb: (...args: unknown[]) => void): void {
    (this.handlers[ev] ??= []).push(cb);
  }

  emit(ev: string, ...args: unknown[]): void {
    for (const cb of this.handlers[ev] ?? []) cb(...args);
  }
}

function createHarness(list: Array<{
  path: string;
  friendlyName?: string;
  vendorId?: string;
  productId?: string;
}> = []) {
  const coordinator = new PortCoordinator();
  const created: MockPort[] = [];
  const createOpts: Array<{ path: string; baudRate: number }> = [];
  const factory: SerialPortFactory = {
    create(opts) {
      createOpts.push(opts);
      const port = new MockPort();
      created.push(port);
      return port;
    },
    list: async () => list,
  };
  const service = new SerialService(coordinator, factory);
  const data: string[] = [];
  const statuses: SerialStatus[] = [];
  service.onData((chunk) => data.push(chunk));
  service.onStatus((status) => statuses.push(status));
  return { coordinator, created, createOpts, service, data, statuses };
}

describe('SerialService', () => {
  it('maps listPorts to SerialPortInfo with friendlyName fallback', async () => {
    const { service } = createHarness([
      { path: 'COM1', friendlyName: 'MeowKit CDC', vendorId: '303A', productId: '1001' },
      { path: 'COM2' },
    ]);

    await expect(service.listPorts()).resolves.toEqual([
      { path: 'COM1', friendlyName: 'MeowKit CDC', vendorId: '303A', productId: '1001' },
      { path: 'COM2', friendlyName: 'COM2' },
    ]);
  });

  it('connects, writes, and pipes utf8 data events', async () => {
    const { coordinator, created, createOpts, service, data, statuses } = createHarness();

    await service.connect({ path: 'COM3', baudRate: 115200 });

    expect(coordinator.getMode()).toBe('serial');
    expect(createOpts).toEqual([{ path: 'COM3', baudRate: 115200 }]);
    expect(created[0].isOpen).toBe(true);
    expect(statuses).toEqual([{ state: 'connected', path: 'COM3', baudRate: 115200 }]);

    await service.write('ping');
    expect(created[0].writes).toEqual(['ping']);

    created[0].emit('data', Buffer.from('pong', 'utf8'));
    expect(data).toEqual(['pong']);
  });

  it('rejects connect when coordinator is flashing', async () => {
    const { coordinator, service, createOpts } = createHarness();
    coordinator.requestFlashing();

    await expect(service.connect({ path: 'COM3', baudRate: 115200 })).rejects.toThrow(
      'Port busy: flashing',
    );
    expect(createOpts).toEqual([]);
    expect(coordinator.getMode()).toBe('flashing');
  });

  it('asTransport reads buffered lines and times out', async () => {
    const { created, service } = createHarness();
    await service.connect({ path: 'COM3', baudRate: 115200 });
    const transport = service.asTransport();

    expect(transport.isConnected()).toBe(true);

    created[0].emit('data', Buffer.from('hello\nwor'));
    await expect(transport.readLine(50)).resolves.toBe('hello');

    created[0].emit('data', Buffer.from('ld\r\n'));
    await expect(transport.readLine(50)).resolves.toBe('world');

    await expect(transport.readLine(20)).resolves.toBeNull();
  });

  describe('auto-reconnect', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('schedules reconnect with backoff while mode stays serial', async () => {
      const { coordinator, created, createOpts, service, statuses } = createHarness();
      await service.connect({ path: 'COM3', baudRate: 115200 });

      created[0].isOpen = false;
      created[0].emit('close');

      expect(coordinator.getMode()).toBe('serial');
      expect(statuses.at(-1)).toEqual({ state: 'reconnecting', path: 'COM3', attempt: 1 });
      expect(createOpts).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(499);
      expect(createOpts).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(createOpts).toEqual([
        { path: 'COM3', baudRate: 115200 },
        { path: 'COM3', baudRate: 115200 },
      ]);
      expect(created[1].isOpen).toBe(true);
      expect(statuses.at(-1)).toEqual({ state: 'connected', path: 'COM3', baudRate: 115200 });
    });

    it('stops reconnect on disconnect()', async () => {
      const { created, createOpts, service, statuses } = createHarness();
      await service.connect({ path: 'COM3', baudRate: 115200 });

      created[0].isOpen = false;
      created[0].emit('close');
      await service.disconnect();

      await vi.advanceTimersByTimeAsync(5000);
      expect(createOpts).toHaveLength(1);
      expect(statuses.at(-1)).toEqual({ state: 'disconnected' });
    });

    it('stops reconnect when mode is not serial', async () => {
      const { coordinator, created, createOpts, service } = createHarness();
      await service.connect({ path: 'COM3', baudRate: 115200 });

      created[0].isOpen = false;
      created[0].emit('close');
      coordinator.requestFlashing();

      await vi.advanceTimersByTimeAsync(5000);
      expect(createOpts).toHaveLength(1);
    });
  });
});
