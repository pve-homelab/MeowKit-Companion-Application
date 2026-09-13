import type {
  FirmwareImage,
  FlashDone,
  FlashProgress,
  PortMode,
  RebootDownloadResult,
  SerialPortInfo,
  SerialStatus,
} from '../shared/ipc';

export interface MeowKitBridge {
  serial: {
    listPorts(): Promise<SerialPortInfo[]>;
    connect(opts: { path: string; baudRate: number }): Promise<void>;
    disconnect(): Promise<void>;
    write(data: string): Promise<void>;
    onData(cb: (chunk: string) => void): () => void;
    onStatus(cb: (status: SerialStatus) => void): () => void;
  };
  flash: {
    getImages(): Promise<FirmwareImage[]>;
    pickCustomImage(): Promise<FirmwareImage | null>;
    start(opts: { imageId?: string; path?: string; erase: boolean }): Promise<void>;
    cancel(): Promise<void>;
    onProgress(cb: (p: FlashProgress) => void): () => void;
    onLog(cb: (line: string) => void): () => void;
    onDone(cb: (done: FlashDone) => void): () => void;
  };
  device: {
    rebootToDownloadMode(): Promise<RebootDownloadResult>;
  };
  app: {
    getPortMode(): Promise<PortMode>;
    onPortMode(cb: (mode: PortMode) => void): () => void;
  };
}

declare global {
  interface Window {
    meowkit: MeowKitBridge;
  }
}

export {};
