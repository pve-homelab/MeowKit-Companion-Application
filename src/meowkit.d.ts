import type {
  AppsSyncResult,
  BuildRunOpts,
  BuildRunResult,
  CatalogApp,
  CompanionSettings,
  FirmwareImage,
  FlashDone,
  FlashProgress,
  FlashStartOpts,
  PortMode,
  DeviceTelemetryResult,
  RebootDownloadResult,
  SerialStatus,
  SerialPortInfo,
  SettingsPatch,
} from '../shared/ipc';
import type { WorkspaceFileNode } from '../shared/workspace';

export interface MeowKitBridge {
  serial: {
    listPorts(): Promise<SerialPortInfo[]>;
    connect(opts: { path: string; baudRate: number }): Promise<void>;
    disconnect(): Promise<void>;
    write(data: string): Promise<void>;
    reset(): Promise<void>;
    saveLog(content: string): Promise<boolean>;
    getStatus(): Promise<SerialStatus>;
    onData(cb: (chunk: string) => void): () => void;
    onStatus(cb: (status: SerialStatus) => void): () => void;
  };
  flash: {
    getImages(): Promise<FirmwareImage[]>;
    pickCustomImage(): Promise<FirmwareImage | null>;
    start(opts: FlashStartOpts): Promise<void>;
    cancel(): Promise<void>;
    onProgress(cb: (p: FlashProgress) => void): () => void;
    onLog(cb: (line: string) => void): () => void;
    onDone(cb: (done: FlashDone) => void): () => void;
  };
  device: {
    rebootToDownloadMode(): Promise<RebootDownloadResult>;
    getTelemetry(): Promise<DeviceTelemetryResult>;
  };
  app: {
    getPortMode(): Promise<PortMode>;
    onPortMode(cb: (mode: PortMode) => void): () => void;
  };
  settings: {
    get(): Promise<CompanionSettings>;
    set(patch: SettingsPatch): Promise<CompanionSettings>;
  };
  workspace: {
    pickFolder(): Promise<string | null>;
    readTree(): Promise<WorkspaceFileNode[]>;
    readFile(relativePath: string): Promise<string>;
    writeFile(relativePath: string, content: string): Promise<void>;
    getRecent(): Promise<string[]>;
    addRecent(path: string): Promise<string[]>;
    createFromTemplate(templateId: string): Promise<string | null>;
  };
  apps: {
    listCatalog(): Promise<CatalogApp[]>;
    getInstalled(): Promise<string[]>;
    install(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    syncToDevice(): Promise<AppsSyncResult>;
  };
  build: {
    run(opts: BuildRunOpts): Promise<BuildRunResult>;
    onLog(cb: (line: string) => void): () => void;
  };
}

declare global {
  interface Window {
    meowkit: MeowKitBridge;
  }
}

export {};
