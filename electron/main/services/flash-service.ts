import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ESPLoader, Transport } from 'esptool-js';
import type { FlashDone, FlashProgress, RebootDownloadResult } from '../../../shared/ipc';
import { rebootToDownloadMode, type SerialTransport } from './device-protocol';
import type { FirmwareStore } from './firmware-store';
import type { PortCoordinator } from './port-coordinator';

const FLASH_ADDRESS = 0x0;
const FLASH_SIZE = '16MB';
const FLASH_MODE = 'keep';
const FLASH_FREQ = 'keep';
const ROM_BAUD = 115200;
const FLASH_BAUD = 921600;

export interface FlashBinaryArgs {
  portPath: string;
  imagePath: string;
  erase: boolean;
  signal: AbortSignal;
  onProgress: (p: FlashProgress) => void;
  onLog: (line: string) => void;
}

export type FlashBinaryFn = (args: FlashBinaryArgs) => Promise<void>;

export interface FlashSerial {
  disconnect(): Promise<void>;
  asTransport(): SerialTransport;
}

export interface FlashNodePort {
  isOpen: boolean;
  open(cb?: (err: Error | null) => void): void;
  close(cb?: (err: Error | null) => void): void;
  write(data: Buffer, cb?: (err?: Error | null) => void): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  set(opts: { dtr?: boolean; rts?: boolean }, cb?: (err: Error | null) => void): void;
  drain?(cb?: (err: Error | null) => void): void;
}

export interface FlashPortFactory {
  create(opts: { path: string; baudRate: number }): FlashNodePort;
  list(): Promise<Array<{ path: string; vendorId?: string; productId?: string }>>;
}

export interface ExecuteFlashOpts {
  imageId?: string;
  path?: string;
  erase: boolean;
  portPath: string;
}

type ProgressListener = (p: FlashProgress) => void;
type LogListener = (line: string) => void;
type DoneListener = (done: FlashDone) => void;

export class FlashService {
  #abort: AbortController | null = null;
  #finished = false;
  #busy = false;
  #progress = new Set<ProgressListener>();
  #logs = new Set<LogListener>();
  #done = new Set<DoneListener>();

  constructor(
    private readonly coordinator: PortCoordinator,
    private readonly store: FirmwareStore,
    private readonly serial: FlashSerial,
    private readonly flashBinary: FlashBinaryFn,
  ) {}

  prepareSoftEntry(): Promise<RebootDownloadResult> {
    const transport = this.serial.asTransport();
    if (!transport.isConnected()) {
      return Promise.resolve({ ok: false, reason: 'not-connected' });
    }
    return rebootToDownloadMode(transport);
  }

  async executeFlash(opts: ExecuteFlashOpts): Promise<void> {
    if (this.#busy || this.coordinator.getMode() === 'flashing') {
      throw new Error('Flash already in progress');
    }
    this.#busy = true;
    this.#abort = new AbortController();
    this.#finished = false;
    try {
      let preempt: Promise<void> | undefined;
      this.coordinator.requestFlashing({
        onPreemptSerial: () => {
          preempt = this.serial.disconnect();
        },
      });
      if (preempt) await preempt;

      const image = await this.store.resolveImage(opts);
      await this.store.verifyBundled(image);

      if (this.#abort.signal.aborted) {
        this.#finish({ ok: false, error: 'aborted' });
        return;
      }

      await this.flashBinary({
        portPath: opts.portPath,
        imagePath: image.path,
        erase: opts.erase,
        signal: this.#abort.signal,
        onProgress: (p) => this.#emitProgress(p),
        onLog: (line) => this.#emitLog(line),
      });

      if (this.#abort.signal.aborted) {
        this.#finish({ ok: false, error: 'aborted' });
        return;
      }
      this.#finish({ ok: true });
    } catch (err) {
      if (this.#abort.signal.aborted || isAbortError(err)) {
        this.#finish({ ok: false, error: 'aborted' });
        return;
      }
      const error = err instanceof Error ? err.message : String(err);
      this.#finish({ ok: false, error });
      throw err;
    } finally {
      this.#busy = false;
      this.coordinator.releaseToIdle();
    }
  }

  start(opts: ExecuteFlashOpts): Promise<void> {
    return this.executeFlash(opts);
  }

  cancel(): void {
    this.#abort?.abort();
  }

  onProgress(cb: ProgressListener): () => void {
    this.#progress.add(cb);
    return () => {
      this.#progress.delete(cb);
    };
  }

  onLog(cb: LogListener): () => void {
    this.#logs.add(cb);
    return () => {
      this.#logs.delete(cb);
    };
  }

  onDone(cb: DoneListener): () => void {
    this.#done.add(cb);
    return () => {
      this.#done.delete(cb);
    };
  }

  #finish(done: FlashDone): void {
    if (this.#finished) return;
    this.#finished = true;
    this.#emitDone(done);
  }

  #emitProgress(p: FlashProgress): void {
    for (const cb of [...this.#progress]) cb(p);
  }

  #emitLog(line: string): void {
    for (const cb of [...this.#logs]) cb(line);
  }

  #emitDone(done: FlashDone): void {
    for (const cb of [...this.#done]) cb(done);
  }
}

/** Production esptool-js adapter: factory bin @ 0x0 for ESP32-S3 / 16MB. */
export function createEspToolFlashBinary(factory: FlashPortFactory): FlashBinaryFn {
  return async (args) => {
    throwIfAborted(args.signal);
    const info = await lookupPortInfo(factory, args.portPath);
    const device = new NodeWebSerialPort(factory, args.portPath, info);
    const transport = new Transport(device as ConstructorParameters<typeof Transport>[0]);
    const onAbort = () => {
      void transport.disconnect().catch(() => undefined);
    };
    args.signal.addEventListener('abort', onAbort, { once: true });
    try {
      throwIfAborted(args.signal);
      const loader = new ESPLoader({
        transport,
        baudrate: FLASH_BAUD,
        romBaudrate: ROM_BAUD,
        terminal: {
          clean() {},
          writeLine: (data) => args.onLog(data),
          write: (data) => args.onLog(data),
        },
      });
      const chip = await loader.main('default_reset');
      args.onLog(`Detected ${chip}`);
      const image = await readFile(args.imagePath);
      await loader.writeFlash({
        fileArray: [{ data: image.toString('latin1'), address: FLASH_ADDRESS }],
        flashSize: FLASH_SIZE,
        flashMode: FLASH_MODE,
        flashFreq: FLASH_FREQ,
        eraseAll: args.erase,
        compress: true,
        reportProgress: (_fileIndex, written, total) => {
          args.onProgress({
            percent: total === 0 ? 100 : Math.min(100, Math.floor((100 * written) / total)),
            bytesWritten: written,
          });
        },
        calculateMD5Hash: (data) => createHash('md5').update(Buffer.from(data, 'latin1')).digest('hex'),
      });
      await loader.after('hard_reset');
    } finally {
      args.signal.removeEventListener('abort', onAbort);
      await transport.disconnect().catch(() => undefined);
    }
    throwIfAborted(args.signal);
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  throw new DOMException('The operation was aborted.', 'AbortError');
}

async function lookupPortInfo(
  factory: FlashPortFactory,
  path: string,
): Promise<{ usbVendorId?: number; usbProductId?: number }> {
  try {
    const ports = await factory.list();
    const match = ports.find((p) => p.path === path);
    if (!match) return {};
    const info: { usbVendorId?: number; usbProductId?: number } = {};
    if (match.vendorId) info.usbVendorId = parseInt(match.vendorId, 16);
    if (match.productId) info.usbProductId = parseInt(match.productId, 16);
    return info;
  } catch {
    return {};
  }
}

class NodeWebSerialPort {
  readable: ReadableStream<Uint8Array> | null = null;
  writable: WritableStream<Uint8Array> | null = null;
  #port: FlashNodePort | null = null;
  #dtr = false;
  #rts = false;
  #onData: ((chunk: unknown) => void) | null = null;

  constructor(
    private readonly factory: FlashPortFactory,
    private readonly path: string,
    private readonly info: { usbVendorId?: number; usbProductId?: number },
  ) {}

  getInfo(): { usbVendorId?: number; usbProductId?: number } {
    return this.info;
  }

  async open(options: { baudRate: number }): Promise<void> {
    await this.#disposePort();
    const port = this.factory.create({ path: this.path, baudRate: options.baudRate });
    this.#port = port;
    await callbackToPromise((cb) => port.open(cb));
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.#onData = (chunk) => {
          controller.enqueue(toUint8(chunk));
        };
        port.on('data', this.#onData);
      },
      cancel: async () => {
        this.#onData = null;
      },
    });
    this.writable = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        const current = this.#port;
        if (!current) throw new Error('Port closed');
        await callbackToPromise((cb) => current.write(Buffer.from(chunk), cb));
        if (current.drain) await callbackToPromise((cb) => current.drain?.(cb));
      },
    });
  }

  async close(): Promise<void> {
    await this.#disposePort();
    this.readable = null;
    this.writable = null;
  }

  async setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void> {
    if (signals.dataTerminalReady !== undefined) this.#dtr = signals.dataTerminalReady;
    if (signals.requestToSend !== undefined) this.#rts = signals.requestToSend;
    const port = this.#port;
    if (!port) return;
    await callbackToPromise((cb) => port.set({ dtr: this.#dtr, rts: this.#rts }, cb));
  }

  async #disposePort(): Promise<void> {
    const port = this.#port;
    this.#port = null;
    if (!port) return;
    if (port.isOpen) await callbackToPromise((cb) => port.close(cb));
  }
}

function callbackToPromise(fn: (cb: (err?: Error | null) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    fn((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function toUint8(chunk: unknown): Uint8Array {
  if (chunk instanceof Uint8Array) return chunk;
  if (Buffer.isBuffer(chunk)) return new Uint8Array(chunk);
  return new Uint8Array(Buffer.from(String(chunk)));
}
