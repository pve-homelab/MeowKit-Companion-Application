import {
  IpcChannels,
  type AppsSyncResult,
  type BuildRunOpts,
  type BuildRunResult,
  type CatalogApp,
  type CompanionSettings,
  type FirmwareImage,
  type FlashDone,
  type FlashProgress,
  type FlashStartOpts,
  type PortMode,
  type DeviceTelemetryResult,
  type RebootDownloadResult,
  type SerialPortInfo,
  type SerialStatus,
  type SettingsPatch,
} from '../../shared/ipc';
import type { WorkspaceFileNode } from '../../shared/workspace';
import type { TemplateId } from '../../shared/templates';
import { rebootToDownloadMode, type SerialTransport } from './services/device-protocol';
import { queryDeviceTelemetry } from './services/device-telemetry';

const JTAG_LABEL = /usb jtag\/serial debug unit/i;

export interface IpcRegistrar {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
}

export interface IpcSerial {
  listPorts(): Promise<SerialPortInfo[]>;
  connect(opts: { path: string; baudRate: number }): Promise<void>;
  disconnect(): Promise<void>;
  write(data: string): Promise<void>;
  reset(): Promise<void>;
  getStatus(): Promise<SerialStatus> | SerialStatus;
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

export interface IpcWorkspace {
  pickFolder(): Promise<string | null>;
  readTree(): Promise<WorkspaceFileNode[]>;
  readFile(relativePath: string): Promise<string>;
  writeFile(relativePath: string, content: string): Promise<void>;
  getRecent(): Promise<string[]>;
  addRecent(path: string): Promise<string[]>;
  createFromTemplate(templateId: string): Promise<string | null>;
}

export interface IpcSettings {
  get(): CompanionSettings;
  set(patch: SettingsPatch): Promise<CompanionSettings>;
}

export interface IpcApps {
  listCatalog(): Promise<CatalogApp[]>;
  getInstalled(): Promise<string[]>;
  install(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  syncToDevice(): Promise<AppsSyncResult>;
}

export interface IpcBuild {
  run(opts: BuildRunOpts): Promise<BuildRunResult>;
  onLog(cb: (line: string) => void): () => void;
}

export interface RegisterIpcDeps {
  ipc: IpcRegistrar;
  send: (channel: string, payload: unknown) => void;
  coordinator: IpcCoordinator;
  serial: IpcSerial;
  flash: IpcFlash;
  store: IpcStore;
  workspace: IpcWorkspace;
  settings: IpcSettings;
  apps: IpcApps;
  build: IpcBuild;
  pickFirmwareFile: () => Promise<string | null>;
  saveSerialLog: (content: string) => Promise<boolean>;
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
  const {
    ipc,
    send,
    coordinator,
    serial,
    flash,
    store,
    workspace,
    settings,
    apps,
    build,
    pickFirmwareFile,
    saveSerialLog,
  } = deps;

  ipc.handle(IpcChannels.serialListPorts, () => serial.listPorts());
  ipc.handle(IpcChannels.serialConnect, (_event, opts) =>
    serial.connect(opts as { path: string; baudRate: number }),
  );
  ipc.handle(IpcChannels.serialDisconnect, () => serial.disconnect());
  ipc.handle(IpcChannels.serialWrite, (_event, data) => serial.write(String(data)));
  ipc.handle(IpcChannels.serialReset, () => serial.reset());
  ipc.handle(IpcChannels.serialSaveLog, (_event, content) => saveSerialLog(String(content)));
  ipc.handle(IpcChannels.serialGetStatus, () => serial.getStatus());
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
  ipc.handle(IpcChannels.deviceGetTelemetry, (): Promise<DeviceTelemetryResult> => {
    return queryDeviceTelemetry(serial.asTransport());
  });
  ipc.handle(IpcChannels.appGetPortMode, () => coordinator.getMode());
  ipc.handle(IpcChannels.workspacePickFolder, () => workspace.pickFolder());
  ipc.handle(IpcChannels.workspaceReadTree, () => workspace.readTree());
  ipc.handle(IpcChannels.workspaceReadFile, (_event, relativePath) =>
    workspace.readFile(String(relativePath)),
  );
  ipc.handle(IpcChannels.workspaceWriteFile, (_event, relativePath, content) =>
    workspace.writeFile(String(relativePath), String(content)),
  );
  ipc.handle(IpcChannels.workspaceGetRecent, () => workspace.getRecent());
  ipc.handle(IpcChannels.workspaceAddRecent, (_event, path) => workspace.addRecent(String(path)));
  ipc.handle(IpcChannels.workspaceCreateFromTemplate, (_event, templateId) =>
    workspace.createFromTemplate(String(templateId) as TemplateId),
  );
  ipc.handle(IpcChannels.settingsGet, () => settings.get());
  ipc.handle(IpcChannels.settingsSet, (_event, patch) =>
    settings.set(patch as SettingsPatch),
  );
  ipc.handle(IpcChannels.appsListCatalog, () => apps.listCatalog());
  ipc.handle(IpcChannels.appsGetInstalled, () => apps.getInstalled());
  ipc.handle(IpcChannels.appsInstall, (_event, id) => apps.install(String(id)));
  ipc.handle(IpcChannels.appsRemove, (_event, id) => apps.remove(String(id)));
  ipc.handle(IpcChannels.appsSyncToDevice, () => apps.syncToDevice());
  ipc.handle(IpcChannels.buildRun, (_event, raw) => build.run(raw as BuildRunOpts));

  serial.onData((chunk) => send(IpcChannels.serialData, chunk));
  serial.onStatus((status) => send(IpcChannels.serialStatus, status));
  flash.onProgress((progress) => send(IpcChannels.flashProgress, progress));
  flash.onLog((line) => send(IpcChannels.flashLog, line));
  flash.onDone((done) => send(IpcChannels.flashDone, done));
  build.onLog((line) => send(IpcChannels.buildLog, line));
  coordinator.onModeChange((mode) => send(IpcChannels.appPortMode, mode));
}
