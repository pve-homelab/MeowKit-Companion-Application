import {
  IpcChannels,
  type FirmwareImage,
  type FlashDone,
  type FlashProgress,
  type FlashStartOpts,
  type PortMode,
  type RebootDownloadResult,
  type SerialPortInfo,
  type SerialStatus,
} from '../../shared/ipc';
import { rebootToDownloadMode, type SerialTransport } from './services/device-protocol';

const JTAG_LABEL = /usb jtag\/serial debug unit/i;

export interface IpcRegistrar {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
}

export interface IpcSerial {
  listPorts(): Promise<SerialPortInfo[]>;
  connect(opts: { path: string; baudRate: number }): Promise<void>;
  disconnect(): Promise<void>;
  write(data: string): Promise<void>;
  onData(cb: (chunk: string) => void): () => void;
  onStatus(cb: (status: SerialStatus) => void): () => void;
  asTransport(): SerialTransport;
}

export interface IpcFlash {
  executeFlash(opts: FlashStartOpts & { portPath: string }): Promise<void>;
  cancel(): void;
  onProgress(cb: (p: FlashProgress) => void): () => void;
  onLog(cb: (line: string) => void): () => void;
  onDone(cb: (done: FlashDone) => void): () => void;
}

export interface IpcStore {
  list(): Promise<FirmwareImage[]>;
  addCustom(path: string): Promise<FirmwareImage>;
}

export interface IpcCoordinator {
  getMode(): PortMode;
  onModeChange(cb: (mode: PortMode) => void): () => void;
}

export interface RegisterIpcDeps {
  ipc: IpcRegistrar;
  send: (channel: string, payload: unknown) => void;
  coordinator: IpcCoordinator;
  serial: IpcSerial;
  flash: IpcFlash;
  store: IpcStore;
  pickFirmwareFile: () => Promise<string | null>;
}

export function resolveFlashPortPath(ports: SerialPortInfo[], portPath?: string): string {
  if (portPath) return portPath;
  const jtag = ports.find((port) => JTAG_LABEL.test(port.friendlyName));
  if (jtag) return jtag.path;
  throw new Error(
    'No flash portPath provided and no USB JTAG/serial debug unit found. Pass portPath or connect the device in download mode.',
  );
}

export function registerIpc(deps: RegisterIpcDeps): void {
  const { ipc, send, coordinator, serial, flash, store, pickFirmwareFile } = deps;

  ipc.handle(IpcChannels.serialListPorts, () => serial.listPorts());
  ipc.handle(IpcChannels.serialConnect, (_event, opts) =>
    serial.connect(opts as { path: string; baudRate: number }),
  );
  ipc.handle(IpcChannels.serialDisconnect, () => serial.disconnect());
  ipc.handle(IpcChannels.serialWrite, (_event, data) => serial.write(String(data)));
  ipc.handle(IpcChannels.flashGetImages, () => store.list());
  ipc.handle(IpcChannels.flashPickCustom, async () => {
    const path = await pickFirmwareFile();
    if (!path) return null;
    return store.addCustom(path);
  });
  ipc.handle(IpcChannels.flashStart, async (_event, raw) => {
    const opts = raw as FlashStartOpts;
    const portPath = resolveFlashPortPath(await serial.listPorts(), opts.portPath);
    return flash.executeFlash({ ...opts, portPath });
  });
  ipc.handle(IpcChannels.flashCancel, () => {
    flash.cancel();
  });
  ipc.handle(IpcChannels.deviceRebootDownload, (): Promise<RebootDownloadResult> => {
    return rebootToDownloadMode(serial.asTransport());
  });
  ipc.handle(IpcChannels.appGetPortMode, () => coordinator.getMode());

  serial.onData((chunk) => send(IpcChannels.serialData, chunk));
  serial.onStatus((status) => send(IpcChannels.serialStatus, status));
  flash.onProgress((progress) => send(IpcChannels.flashProgress, progress));
  flash.onLog((line) => send(IpcChannels.flashLog, line));
  flash.onDone((done) => send(IpcChannels.flashDone, done));
  coordinator.onModeChange((mode) => send(IpcChannels.appPortMode, mode));
}
