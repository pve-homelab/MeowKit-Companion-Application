import { describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../shared/ipc';
import { createMeowKitBridge } from '../electron/preload/index';

function createIpc() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    invoke: vi.fn(async (channel: string, ...args: unknown[]) => ({ channel, args })),
    on(channel: string, listener: (...args: unknown[]) => void) {
      const set = listeners.get(channel) ?? new Set();
      set.add(listener);
      listeners.set(channel, set);
    },
    removeListener(channel: string, listener: (...args: unknown[]) => void) {
      listeners.get(channel)?.delete(listener);
    },
    emit(channel: string, ...args: unknown[]) {
      for (const listener of listeners.get(channel) ?? []) listener({}, ...args);
    },
    listenerCount(channel: string) {
      return listeners.get(channel)?.size ?? 0;
    },
  };
}

describe('createMeowKitBridge', () => {
  it('maps invoke methods onto IpcChannels', async () => {
    const ipc = createIpc();
    const meowkit = createMeowKitBridge(ipc);

    await meowkit.serial.listPorts();
    await meowkit.serial.connect({ path: 'COM1', baudRate: 115200 });
    await meowkit.serial.write('x');
    await meowkit.serial.reset();
    await meowkit.serial.saveLog('boot\n');
    await meowkit.serial.disconnect();
    await meowkit.serial.getStatus();
    await meowkit.flash.getImages();
    await meowkit.flash.pickCustomImage();
    await meowkit.flash.start({ imageId: 'bundled:v1.0.0', erase: false, portPath: 'COM3' });
    await meowkit.flash.cancel();
    await meowkit.device.rebootToDownloadMode();
    await meowkit.device.getTelemetry();
    await meowkit.app.getPortMode();
    await meowkit.settings.get();
    await meowkit.settings.set({ serial: { defaultBaudRate: 57600 } });
    await meowkit.workspace.pickFolder();
    await meowkit.workspace.readTree();
    await meowkit.workspace.readFile('README.md');
    await meowkit.workspace.writeFile('README.md', '# updated');
    await meowkit.workspace.getRecent();
    await meowkit.workspace.addRecent('C:/project');
    await meowkit.workspace.createFromTemplate('arduino-blink');
    await meowkit.apps.listCatalog();
    await meowkit.apps.getInstalled();
    await meowkit.apps.install('retrotv');
    await meowkit.apps.remove('retrotv');
    await meowkit.apps.syncToDevice();
    await meowkit.build.run({ projectPath: 'C:/project' });

    expect(ipc.invoke.mock.calls.map((call) => call[0])).toEqual([
      IpcChannels.serialListPorts,
      IpcChannels.serialConnect,
      IpcChannels.serialWrite,
      IpcChannels.serialReset,
      IpcChannels.serialSaveLog,
      IpcChannels.serialDisconnect,
      IpcChannels.serialGetStatus,
      IpcChannels.flashGetImages,
      IpcChannels.flashPickCustom,
      IpcChannels.flashStart,
      IpcChannels.flashCancel,
      IpcChannels.deviceRebootDownload,
      IpcChannels.deviceGetTelemetry,
      IpcChannels.appGetPortMode,
      IpcChannels.settingsGet,
      IpcChannels.settingsSet,
      IpcChannels.workspacePickFolder,
      IpcChannels.workspaceReadTree,
      IpcChannels.workspaceReadFile,
      IpcChannels.workspaceWriteFile,
      IpcChannels.workspaceGetRecent,
      IpcChannels.workspaceAddRecent,
      IpcChannels.workspaceCreateFromTemplate,
      IpcChannels.appsListCatalog,
      IpcChannels.appsGetInstalled,
      IpcChannels.appsInstall,
      IpcChannels.appsRemove,
      IpcChannels.appsSyncToDevice,
      IpcChannels.buildRun,
    ]);
    expect(ipc.invoke).toHaveBeenCalledWith(IpcChannels.flashStart, {
      imageId: 'bundled:v1.0.0',
      erase: false,
      portPath: 'COM3',
    });
  });

  it('unsubscribes build log listeners', () => {
    const ipc = createIpc();
    const meowkit = createMeowKitBridge(ipc);
    const lines: string[] = [];
    const off = meowkit.build.onLog((line) => lines.push(line));
    ipc.emit(IpcChannels.buildLog, 'done');
    off();
    ipc.emit(IpcChannels.buildLog, 'ignored');
    expect(lines).toEqual(['done']);
    expect(ipc.listenerCount(IpcChannels.buildLog)).toBe(0);
  });

  it('unsubscribes serial data listeners', () => {
    const ipc = createIpc();
    const meowkit = createMeowKitBridge(ipc);
    const chunks: string[] = [];
    const off = meowkit.serial.onData((chunk) => chunks.push(chunk));
    ipc.emit(IpcChannels.serialData, 'a');
    off();
    ipc.emit(IpcChannels.serialData, 'b');
    expect(chunks).toEqual(['a']);
    expect(ipc.listenerCount(IpcChannels.serialData)).toBe(0);
  });
});
