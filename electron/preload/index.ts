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
    },
    app: {
      getPortMode: () => ipc.invoke(IpcChannels.appGetPortMode) as ReturnType<MeowKitBridge['app']['getPortMode']>,
      onPortMode: (cb) => subscribe(ipc, IpcChannels.appPortMode, cb),
    },
  };
}

if (typeof contextBridge?.exposeInMainWorld === 'function') {
  contextBridge.exposeInMainWorld('meowkit', createMeowKitBridge(ipcRenderer));
}
