import { contextBridge, ipcRenderer } from 'electron';
import type { MeowKitBridge } from '../../src/meowkit';
import { IpcChannels } from '../../shared/ipc';

export interface IpcRendererLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
}

function subscribe<T>(ipc: IpcRendererLike, channel: string, cb: (payload: T) => void): () => void {
  const listener = (...args: unknown[]) => cb(args[1] as T);
  ipc.on(channel, listener);
  return () => ipc.removeListener(channel, listener);
}

export function createMeowKitBridge(ipc: IpcRendererLike): MeowKitBridge {
  return {
    serial: {
      listPorts: () => ipc.invoke(IpcChannels.serialListPorts) as ReturnType<MeowKitBridge['serial']['listPorts']>,
      connect: (opts) => ipc.invoke(IpcChannels.serialConnect, opts) as Promise<void>,
      disconnect: () => ipc.invoke(IpcChannels.serialDisconnect) as Promise<void>,
      write: (data) => ipc.invoke(IpcChannels.serialWrite, data) as Promise<void>,
      reset: () => ipc.invoke(IpcChannels.serialReset) as Promise<void>,
      saveLog: (content) =>
        ipc.invoke(IpcChannels.serialSaveLog, content) as ReturnType<MeowKitBridge['serial']['saveLog']>,
      getStatus: () => ipc.invoke(IpcChannels.serialGetStatus) as ReturnType<MeowKitBridge['serial']['getStatus']>,
      onData: (cb) => subscribe(ipc, IpcChannels.serialData, cb),
      onStatus: (cb) => subscribe(ipc, IpcChannels.serialStatus, cb),
    },
    flash: {
      getImages: () => ipc.invoke(IpcChannels.flashGetImages) as ReturnType<MeowKitBridge['flash']['getImages']>,
      pickCustomImage: () =>
        ipc.invoke(IpcChannels.flashPickCustom) as ReturnType<MeowKitBridge['flash']['pickCustomImage']>,
      start: (opts) => ipc.invoke(IpcChannels.flashStart, opts) as Promise<void>,
      cancel: () => ipc.invoke(IpcChannels.flashCancel) as Promise<void>,
      onProgress: (cb) => subscribe(ipc, IpcChannels.flashProgress, cb),
      onLog: (cb) => subscribe(ipc, IpcChannels.flashLog, cb),
      onDone: (cb) => subscribe(ipc, IpcChannels.flashDone, cb),
    },
    device: {
      rebootToDownloadMode: () =>
        ipc.invoke(IpcChannels.deviceRebootDownload) as ReturnType<MeowKitBridge['device']['rebootToDownloadMode']>,
      getTelemetry: () =>
        ipc.invoke(IpcChannels.deviceGetTelemetry) as ReturnType<MeowKitBridge['device']['getTelemetry']>,
    },
    app: {
      getPortMode: () => ipc.invoke(IpcChannels.appGetPortMode) as ReturnType<MeowKitBridge['app']['getPortMode']>,
      onPortMode: (cb) => subscribe(ipc, IpcChannels.appPortMode, cb),
    },
    settings: {
      get: () => ipc.invoke(IpcChannels.settingsGet) as ReturnType<MeowKitBridge['settings']['get']>,
      set: (patch) =>
        ipc.invoke(IpcChannels.settingsSet, patch) as ReturnType<MeowKitBridge['settings']['set']>,
    },
    workspace: {
      pickFolder: () =>
        ipc.invoke(IpcChannels.workspacePickFolder) as ReturnType<MeowKitBridge['workspace']['pickFolder']>,
      readTree: () =>
        ipc.invoke(IpcChannels.workspaceReadTree) as ReturnType<MeowKitBridge['workspace']['readTree']>,
      readFile: (relativePath) =>
        ipc.invoke(IpcChannels.workspaceReadFile, relativePath) as ReturnType<
          MeowKitBridge['workspace']['readFile']
        >,
      writeFile: (relativePath, content) =>
        ipc.invoke(IpcChannels.workspaceWriteFile, relativePath, content) as ReturnType<
          MeowKitBridge['workspace']['writeFile']
        >,
      getRecent: () =>
        ipc.invoke(IpcChannels.workspaceGetRecent) as ReturnType<MeowKitBridge['workspace']['getRecent']>,
      addRecent: (path) =>
        ipc.invoke(IpcChannels.workspaceAddRecent, path) as ReturnType<
          MeowKitBridge['workspace']['addRecent']
        >,
      createFromTemplate: (templateId) =>
        ipc.invoke(IpcChannels.workspaceCreateFromTemplate, templateId) as ReturnType<
          MeowKitBridge['workspace']['createFromTemplate']
        >,
    },
    apps: {
      listCatalog: () =>
        ipc.invoke(IpcChannels.appsListCatalog) as ReturnType<MeowKitBridge['apps']['listCatalog']>,
      getInstalled: () =>
        ipc.invoke(IpcChannels.appsGetInstalled) as ReturnType<MeowKitBridge['apps']['getInstalled']>,
      install: (id) =>
        ipc.invoke(IpcChannels.appsInstall, id) as ReturnType<MeowKitBridge['apps']['install']>,
      remove: (id) =>
        ipc.invoke(IpcChannels.appsRemove, id) as ReturnType<MeowKitBridge['apps']['remove']>,
      syncToDevice: () =>
        ipc.invoke(IpcChannels.appsSyncToDevice) as ReturnType<MeowKitBridge['apps']['syncToDevice']>,
    },
    build: {
      run: (opts) => ipc.invoke(IpcChannels.buildRun, opts) as ReturnType<MeowKitBridge['build']['run']>,
      onLog: (cb) => subscribe(ipc, IpcChannels.buildLog, cb),
    },
  };
}

if (typeof contextBridge?.exposeInMainWorld === 'function') {
  contextBridge.exposeInMainWorld('meowkit', createMeowKitBridge(ipcRenderer));
}
