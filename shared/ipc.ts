import type { CatalogApp } from './apps';
import type { DeviceTelemetry } from './telemetry';

export type { CatalogApp, DeviceTelemetry };

import type { CompanionSettings, SettingsPatch } from './settings';

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

export type DeviceTelemetryResult =
  | { ok: true; telemetry: DeviceTelemetry }
  | { ok: false; reason: 'unsupported' | 'not-connected' | 'error'; message?: string };

export type FlashProgress = { percent: number; bytesWritten?: number };
export type FlashDone = { ok: boolean; error?: string };

export interface FlashStartOpts {
  imageId?: string;
  path?: string;
  erase: boolean;
  portPath?: string;
}

export interface BuildRunOpts {
  projectPath: string;
}

export interface BuildRunResult {
  ok: boolean;
  outputPath?: string;
}

export type AppsSyncResult =
  | { ok: true; syncedIds: string[] }
  | {
      ok: false;
      reason: 'msc-unavailable' | 'nothing-staged' | 'error';
      message: string;
      stagedIds: string[];
    };


export const IpcChannels = {
  serialListPorts: 'serial:listPorts',
  serialConnect: 'serial:connect',
  serialDisconnect: 'serial:disconnect',
  serialWrite: 'serial:write',
  serialGetStatus: 'serial:getStatus',
  serialReset: 'serial:reset',
  serialSaveLog: 'serial:saveLog',
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
  deviceGetTelemetry: 'device:getTelemetry',
  appGetPortMode: 'app:getPortMode',
  appPortMode: 'app:portMode',
  workspacePickFolder: 'workspace:pickFolder',
  workspaceReadTree: 'workspace:readTree',
  workspaceReadFile: 'workspace:readFile',
  workspaceWriteFile: 'workspace:writeFile',
  workspaceGetRecent: 'workspace:getRecent',
  workspaceAddRecent: 'workspace:addRecent',
  workspaceCreateFromTemplate: 'workspace:createFromTemplate',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  appsListCatalog: 'apps:listCatalog',
  appsGetInstalled: 'apps:getInstalled',
  appsInstall: 'apps:install',
  appsRemove: 'apps:remove',
  appsSyncToDevice: 'apps:syncToDevice',
  buildRun: 'build:run',
  buildLog: 'build:log',
} as const;

export type { CompanionSettings, SettingsPatch };
