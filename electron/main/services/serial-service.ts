import type { SerialPortInfo, SerialStatus } from '../../../shared/ipc';
import type { SerialTransport } from './device-protocol';
import type { PortCoordinator } from './port-coordinator';

export interface SerialPortLike {
  isOpen: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  write(data: Buffer | Uint8Array | string, cb: (err?: Error | null) => void): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  set?(opts: { dtr?: boolean; rts?: boolean }): Promise<void>;
}

export interface ListedSerialPort {
  path: string;
  friendlyName?: string;
  vendorId?: string;
  productId?: string;
}

export interface SerialPortFactory {
  create(opts: { path: string; baudRate: number }): SerialPortLike;
  list(): Promise<ListedSerialPort[]>;
}

type DataListener = (chunk: string) => void;
type StatusListener = (status: SerialStatus) => void;
type LineWaiter = {
  resolve: (line: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

const BACKOFF_MS = [500, 1000, 2000, 5000] as const;
const MAX_BACKOFF_MS = 5000;

export class SerialService {
  #factory: SerialPortFactory;
  #port: SerialPortLike | null = null;
  #path = '';
  #baudRate = 115200;
  #wantOpen = false;
  #closing = false;
  #attempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #lineBuffer = '';
  #lineWaiters: LineWaiter[] = [];
  #dataListeners = new Set<DataListener>();
  #statusListeners = new Set<StatusListener>();
  #status: SerialStatus = { state: 'disconnected' };

  constructor(
    private readonly coordinator: PortCoordinator,
    factory: SerialPortFactory,
  ) {
    this.#factory = factory;
    this.coordinator.onModeChange((mode) => {
      if (mode !== 'serial') this.#cancelReconnect();
    });
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    const ports = await this.#factory.list();
    return ports.map((port) => {
      const info: SerialPortInfo = {
        path: port.path,
        friendlyName: port.friendlyName || port.path,
      };
      if (port.vendorId) info.vendorId = port.vendorId;
      if (port.productId) info.productId = port.productId;
      return info;
    });
  }

  async connect(opts: { path: string; baudRate?: number }): Promise<void> {
    if (!this.coordinator.requestSerial()) {
      throw new Error('Port busy: flashing');
    }
    this.#cancelReconnect();
    await this.#closePort();
    this.#path = opts.path;
    this.#baudRate = opts.baudRate ?? 115200;
    this.#wantOpen = true;
    this.#attempt = 0;
    await this.#openPort();
  }

  async disconnect(): Promise<void> {
    this.#wantOpen = false;
    this.#cancelReconnect();
    await this.#closePort();
    this.#rejectLineWaiters();
    if (this.coordinator.getMode() === 'serial') {
      this.coordinator.releaseToIdle();
    }
    this.#emitStatus({ state: 'disconnected' });
  }

  async write(data: string | Uint8Array): Promise<void> {
    const port = this.#port;
    if (!port?.isOpen) throw new Error('Not connected');
    const payload = typeof data === 'string' ? data : Buffer.from(data);
    await new Promise<void>((resolve, reject) => {
      port.write(payload, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async reset(): Promise<void> {
    const port = this.#port;
    if (!port?.isOpen) throw new Error('Not connected');
    if (!port.set) throw new Error('Port does not support DTR control');
    await port.set({ dtr: false });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await port.set({ dtr: true });
  }

  getStatus(): SerialStatus {
    return this.#status;
  }

  onData(cb: DataListener): () => void {
    this.#dataListeners.add(cb);
    return () => {
      this.#dataListeners.delete(cb);
    };
  }

  onStatus(cb: StatusListener): () => void {
    this.#statusListeners.add(cb);
    return () => {
      this.#statusListeners.delete(cb);
    };
  }

  asTransport(): SerialTransport {
    return {
      isConnected: () => this.#port?.isOpen === true,
      write: (data) => this.write(data),
      readLine: (timeoutMs) => this.#readLine(timeoutMs),
    };
  }

  async #openPort(): Promise<void> {
    this.#rejectLineWaiters();
    const previous = this.#port;
    this.#port = null;
    if (previous) await this.#disposePort(previous);

    const port = this.#factory.create({ path: this.#path, baudRate: this.#baudRate });
    this.#port = port;
    port.on('data', (chunk) => this.#onBytes(this.#toUtf8(chunk)));
    port.on('close', () => this.#handleClose());
    await port.open();
    this.#attempt = 0;
    this.#emitStatus({ state: 'connected', path: this.#path, baudRate: this.#baudRate });
  }

  async #closePort(): Promise<void> {
    const port = this.#port;
    this.#port = null;
    if (!port) return;
    await this.#disposePort(port);
  }

  async #disposePort(port: SerialPortLike): Promise<void> {
    this.#closing = true;
    try {
      if (port.isOpen) await port.close();
      if ('removeAllListeners' in port && typeof port.removeAllListeners === 'function') {
        port.removeAllListeners();
      }
    } finally {
      this.#closing = false;
    }
  }

  #handleClose(): void {
    if (this.#closing || !this.#wantOpen) return;
    if (this.coordinator.getMode() !== 'serial') {
      this.#wantOpen = false;
      return;
    }
    this.#scheduleReconnect();
  }

  #scheduleReconnect(): void {
    if (this.#reconnectTimer || !this.#wantOpen) return;
    if (this.coordinator.getMode() !== 'serial') return;
    this.#attempt += 1;
    this.#emitStatus({ state: 'reconnecting', path: this.#path, attempt: this.#attempt });
    const delay = this.#backoffMs(this.#attempt);
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      void this.#tryReconnect();
    }, delay);
  }

  async #tryReconnect(): Promise<void> {
    if (!this.#wantOpen || this.coordinator.getMode() !== 'serial') return;
    try {
      await this.#openPort();
    } catch (err) {
      this.#emitStatus({
        state: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      this.#scheduleReconnect();
    }
  }

  #backoffMs(attempt: number): number {
    return BACKOFF_MS[attempt - 1] ?? MAX_BACKOFF_MS;
  }

  #cancelReconnect(): void {
    if (!this.#reconnectTimer) return;
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
  }

  #onBytes(chunk: string): void {
    this.#emitData(chunk);
    this.#lineBuffer += chunk;
    this.#flushLines();
  }

  #readLine(timeoutMs: number): Promise<string | null> {
    const ready = this.#takeLine();
    if (ready !== undefined) return Promise.resolve(ready);
    return new Promise((resolve) => {
      const waiter: LineWaiter = {
        resolve,
        timer: setTimeout(() => {
          this.#removeWaiter(waiter);
          resolve(null);
        }, timeoutMs),
      };
      this.#lineWaiters.push(waiter);
    });
  }

  #flushLines(): void {
    while (this.#lineWaiters.length > 0) {
      const line = this.#takeLine();
      if (line === undefined) return;
      const waiter = this.#lineWaiters.shift();
      if (!waiter) return;
      clearTimeout(waiter.timer);
      waiter.resolve(line);
    }
  }

  #takeLine(): string | undefined {
    const idx = this.#lineBuffer.indexOf('\n');
    if (idx < 0) return undefined;
    let line = this.#lineBuffer.slice(0, idx);
    this.#lineBuffer = this.#lineBuffer.slice(idx + 1);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    return line;
  }

  #removeWaiter(waiter: LineWaiter): void {
    const idx = this.#lineWaiters.indexOf(waiter);
    if (idx >= 0) this.#lineWaiters.splice(idx, 1);
  }

  #rejectLineWaiters(): void {
    const waiters = this.#lineWaiters;
    this.#lineWaiters = [];
    this.#lineBuffer = '';
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
  }

  #toUtf8(chunk: unknown): string {
    if (typeof chunk === 'string') return chunk;
    if (Buffer.isBuffer(chunk)) return chunk.toString('utf8');
    if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString('utf8');
    return String(chunk);
  }

  #emitData(chunk: string): void {
    for (const cb of [...this.#dataListeners]) cb(chunk);
  }

  #emitStatus(status: SerialStatus): void {
    this.#status = status;
    for (const cb of [...this.#statusListeners]) cb(status);
  }
}
