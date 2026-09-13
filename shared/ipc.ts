export type PortMode = 'idle' | 'serial' | 'flashing';

export interface SerialPortInfo {
  path: string;
  friendlyName: string;
  vendorId?: string;
  productId?: string;
}

export type SerialStatus =
  | { state: 'connected'; path: string; baudRate: number }
  | { state: 'disconnected' }
  | { state: 'reconnecting'; path: string; attempt: number }
  | { state: 'error'; message: string };

export interface FirmwareImage {
  id: string;
  label: string;
  version?: string;
  path: string;
  sha256?: string;
  source: 'bundled' | 'custom';
}

export type RebootDownloadResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'not-connected' | 'error'; message?: string };

export type FlashProgress = { percent: number; bytesWritten?: number };
export type FlashDone = { ok: boolean; error?: string };

export interface FlashStartOpts {
  imageId?: string;
  path?: string;
  erase: boolean;
  portPath?: string;
}

export const IpcChannels = {
  serialListPorts: 'serial:listPorts',
  serialConnect: 'serial:connect',
  serialDisconnect: 'serial:disconnect',
  serialWrite: 'serial:write',
  serialData: 'serial:data',
  serialStatus: 'serial:status',
  flashGetImages: 'flash:getImages',
  flashPickCustom: 'flash:pickCustom',
  flashStart: 'flash:start',
  flashCancel: 'flash:cancel',
  flashProgress: 'flash:progress',
  flashLog: 'flash:log',
  flashDone: 'flash:done',
  deviceRebootDownload: 'device:rebootToDownloadMode',
  appGetPortMode: 'app:getPortMode',
  appPortMode: 'app:portMode',
} as const;
