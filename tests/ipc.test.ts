import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { IpcChannels, type FirmwareImage, type PortMode } from '../shared/ipc';
import { PortCoordinator } from '../electron/main/services/port-coordinator';
import { registerIpc } from '../electron/main/ipc';

function createHarness() {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
  const sent: Array<{ channel: string; payload: unknown }> = [];
  const coordinator = new PortCoordinator();

  const serial = {
    listPorts: vi.fn(async () => [
      { path: 'COM3', friendlyName: 'USB JTAG/serial debug unit', vendorId: '303A', productId: '1001' },
      { path: 'COM4', friendlyName: 'USB Serial Device' },
    ]),
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    onData: vi.fn((cb: (chunk: string) => void) => {
      serial.emitData = cb;
      return () => undefined;
    }),
    onStatus: vi.fn((cb: (status: { state: 'disconnected' }) => void) => {
      serial.emitStatus = cb;
      return () => undefined;
    }),
    getStatus: vi.fn(async () => ({ state: 'disconnected' as const })),
    asTransport: vi.fn(() => ({
      isConnected: () => false,
      write: async () => undefined,
      readLine: async () => null,
    })),
    emitData: undefined as ((chunk: string) => void) | undefined,
    emitStatus: undefined as ((status: { state: 'disconnected' }) => void) | undefined,
  };

  const flash = {
    executeFlash: vi.fn(async () => undefined),
    cancel: vi.fn(),
    onProgress: vi.fn((cb: (p: { percent: number }) => void) => {
      flash.emitProgress = cb;
      return () => undefined;
    }),
    onLog: vi.fn((cb: (line: string) => void) => {
      flash.emitLog = cb;
      return () => undefined;
    }),
    onDone: vi.fn((cb: (done: { ok: boolean }) => void) => {
      flash.emitDone = cb;
      return () => undefined;
    }),
    emitProgress: undefined as ((p: { percent: number }) => void) | undefined,
    emitLog: undefined as ((line: string) => void) | undefined,
    emitDone: undefined as ((done: { ok: boolean }) => void) | undefined,
  };

  const customImage: FirmwareImage = {
    id: 'custom:C:/fw.bin',
    label: 'fw.bin',
    path: 'C:/fw.bin',
    source: 'custom',
  };
  const store = {
    list: vi.fn(async () => [] as FirmwareImage[]),
    addCustom: vi.fn(async () => customImage),
  };
  const pickFirmwareFile = vi.fn(async () => 'C:/fw.bin' as string | null);
  const saveSerialLog = vi.fn(async () => true);
  const workspace = {
    pickFolder: vi.fn(async () => 'C:/project' as string | null),
    readTree: vi.fn(async () => [{ id: 'README.md', name: 'README.md', type: 'file' as const }]),
    readFile: vi.fn(async () => '# hello'),
    writeFile: vi.fn(async () => undefined),
    getRecent: vi.fn(async () => ['C:/project']),
    addRecent: vi.fn(async () => ['C:/project']),
    createFromTemplate: vi.fn(async () => 'C:/project' as string | null),
  };
  const settings = {
    get: vi.fn(() => DEFAULT_SETTINGS),
    set: vi.fn(async () => ({
      ...DEFAULT_SETTINGS,
      serial: { ...DEFAULT_SETTINGS.serial, defaultBaudRate: 57600 },
    })),
  };
  const apps = {
    listCatalog: vi.fn(async () => []),
    getInstalled: vi.fn(async () => []),
    install: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    syncToDevice: vi.fn(async () => ({
      ok: false as const,
      reason: 'msc-unavailable' as const,
      message: 'staged only',
      stagedIds: [] as string[],
    })),
  };
  const build = {
    run: vi.fn(async () => ({ ok: false })),
    onLog: vi.fn((cb: (line: string) => void) => {
      build.emitLog = cb;
      return () => undefined;
    }),
    emitLog: undefined as ((line: string) => void) | undefined,
  };

  registerIpc({
    ipc: {
      handle(channel, listener) {
        handlers.set(channel, listener);
      },
    },
    send: (channel, payload) => sent.push({ channel, payload }),
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
  });

  async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`missing handler: ${channel}`);
    return (await handler({}, ...args)) as T;
  }

  return {
    handlers,
    sent,
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
    invoke,
  };
}

describe('registerIpc', () => {
  it('registers invoke handlers for every request channel', () => {
    const { handlers } = createHarness();
    expect([...handlers.keys()].sort()).toEqual(
      [
        IpcChannels.serialListPorts,
        IpcChannels.serialConnect,
        IpcChannels.serialDisconnect,
        IpcChannels.serialWrite,
        IpcChannels.serialReset,
        IpcChannels.serialSaveLog,
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
        IpcChannels.appsListCatalog,
        IpcChannels.appsGetInstalled,
        IpcChannels.appsInstall,
        IpcChannels.appsRemove,
        IpcChannels.appsSyncToDevice,
        IpcChannels.buildRun,
        IpcChannels.workspacePickFolder,
        IpcChannels.workspaceReadTree,
        IpcChannels.workspaceReadFile,
        IpcChannels.workspaceWriteFile,
        IpcChannels.workspaceGetRecent,
        IpcChannels.workspaceAddRecent,
        IpcChannels.workspaceCreateFromTemplate,
      ].sort(),
    );
  });

  it('lists serial ports through SerialService', async () => {
    const { invoke } = createHarness();
    const ports = await invoke<Array<{ path: string }>>(IpcChannels.serialListPorts);
    expect(ports[0]?.path).toBe('COM3');
  });

  it('connects, writes, and disconnects serial', async () => {
    const { invoke, serial } = createHarness();
    await invoke(IpcChannels.serialConnect, { path: 'COM4', baudRate: 115200 });
    await invoke(IpcChannels.serialWrite, 'hello');
    await invoke(IpcChannels.serialReset);
    await invoke(IpcChannels.serialDisconnect);
    expect(serial.connect).toHaveBeenCalledWith({ path: 'COM4', baudRate: 115200 });
    expect(serial.write).toHaveBeenCalledWith('hello');
    expect(serial.reset).toHaveBeenCalledOnce();
    expect(serial.disconnect).toHaveBeenCalledOnce();
  });

  it('saves serial log content through saveSerialLog', async () => {
    const { invoke, saveSerialLog } = createHarness();
    await expect(invoke<boolean>(IpcChannels.serialSaveLog, 'boot\n')).resolves.toBe(true);
    expect(saveSerialLog).toHaveBeenCalledWith('boot\n');
  });

  it('returns current serial status from getStatus', async () => {
    const { invoke, serial } = createHarness();
    serial.getStatus.mockResolvedValueOnce({ state: 'connected', path: 'COM3', baudRate: 115200 });
    await expect(invoke(IpcChannels.serialGetStatus)).resolves.toEqual({
      state: 'connected',
      path: 'COM3',
      baudRate: 115200,
    });
  });

  it('returns firmware images and custom pick results', async () => {
    const { invoke, store, pickFirmwareFile } = createHarness();
    store.list.mockResolvedValueOnce([{ id: 'bundled:v1.0.0', label: 'factory', path: '/b.bin', source: 'bundled' }]);
    await expect(invoke(IpcChannels.flashGetImages)).resolves.toEqual([
      { id: 'bundled:v1.0.0', label: 'factory', path: '/b.bin', source: 'bundled' },
    ]);
    await expect(invoke(IpcChannels.flashPickCustom)).resolves.toMatchObject({ path: 'C:/fw.bin', source: 'custom' });
    expect(store.addCustom).toHaveBeenCalledWith('C:/fw.bin');

    pickFirmwareFile.mockResolvedValueOnce(null);
    await expect(invoke(IpcChannels.flashPickCustom)).resolves.toBeNull();
  });

  it('starts flash with explicit portPath', async () => {
    const { invoke, flash } = createHarness();
    await invoke(IpcChannels.flashStart, { imageId: 'bundled:v1.0.0', erase: false, portPath: 'COM9' });
    expect(flash.executeFlash).toHaveBeenCalledWith({
      imageId: 'bundled:v1.0.0',
      erase: false,
      portPath: 'COM9',
    });
  });

  it('prefers the USB JTAG port when flash.start omits portPath', async () => {
    const { invoke, flash } = createHarness();
    await invoke(IpcChannels.flashStart, { imageId: 'bundled:v1.0.0', erase: true });
    expect(flash.executeFlash).toHaveBeenCalledWith({
      imageId: 'bundled:v1.0.0',
      erase: true,
      portPath: 'COM3',
    });
  });

  it('rejects flash.start when portPath is omitted and no JTAG port exists', async () => {
    const { invoke, serial } = createHarness();
    serial.listPorts.mockResolvedValueOnce([{ path: 'COM4', friendlyName: 'USB Serial Device' }]);
    await expect(invoke(IpcChannels.flashStart, { path: 'C:/x.bin', erase: false })).rejects.toThrow(/jtag/i);
  });

  it('cancels flash and reports port mode', async () => {
    const { invoke, flash, coordinator } = createHarness();
    coordinator.requestSerial();
    await invoke(IpcChannels.flashCancel);
    expect(flash.cancel).toHaveBeenCalledOnce();
    await expect(invoke<PortMode>(IpcChannels.appGetPortMode)).resolves.toBe('serial');
  });

  it('reboots to download mode via serial transport', async () => {
    const { invoke, serial } = createHarness();
    await expect(invoke(IpcChannels.deviceRebootDownload)).resolves.toEqual({
      ok: false,
      reason: 'not-connected',
    });
    expect(serial.asTransport).toHaveBeenCalled();
  });

  it('queries device telemetry via serial transport', async () => {
    const { invoke, serial } = createHarness();
    await expect(invoke(IpcChannels.deviceGetTelemetry)).resolves.toEqual({
      ok: false,
      reason: 'not-connected',
    });
    expect(serial.asTransport).toHaveBeenCalled();
  });

  it('reads and updates settings through SettingsStore', async () => {
    const { invoke, settings } = createHarness();
    await expect(invoke(IpcChannels.settingsGet)).resolves.toEqual(DEFAULT_SETTINGS);
    await expect(
      invoke(IpcChannels.settingsSet, { serial: { defaultBaudRate: 57600 } }),
    ).resolves.toMatchObject({ serial: { defaultBaudRate: 57600 } });
    expect(settings.set).toHaveBeenCalledWith({ serial: { defaultBaudRate: 57600 } });
  });

  it('lists apps catalog and installs by id', async () => {
    const { invoke, apps } = createHarness();
    apps.listCatalog.mockResolvedValueOnce([
      {
        id: 'retrotv',
        name: 'RetroTV',
        description: 'IR',
        version: '1.0.0',
        category: 'entertainment',
      },
    ]);
    await expect(invoke(IpcChannels.appsListCatalog)).resolves.toEqual([
      {
        id: 'retrotv',
        name: 'RetroTV',
        description: 'IR',
        version: '1.0.0',
        category: 'entertainment',
      },
    ]);
    await invoke(IpcChannels.appsInstall, 'retrotv');
    expect(apps.install).toHaveBeenCalledWith('retrotv');
    await expect(invoke(IpcChannels.appsGetInstalled)).resolves.toEqual([]);
    await expect(invoke(IpcChannels.appsSyncToDevice)).resolves.toMatchObject({
      ok: false,
      reason: 'msc-unavailable',
    });
  });

  it('runs build through BuildService', async () => {
    const { invoke, build } = createHarness();
    await expect(invoke(IpcChannels.buildRun, { projectPath: 'C:/project' })).resolves.toEqual({
      ok: false,
    });
    expect(build.run).toHaveBeenCalledWith({ projectPath: 'C:/project' });
  });

  it('reads and writes workspace files through WorkspaceService', async () => {
    const { invoke, workspace } = createHarness();
    await expect(invoke(IpcChannels.workspacePickFolder)).resolves.toBe('C:/project');
    await expect(invoke(IpcChannels.workspaceReadTree)).resolves.toEqual([
      { id: 'README.md', name: 'README.md', type: 'file' },
    ]);
    await expect(invoke<string>(IpcChannels.workspaceReadFile, 'README.md')).resolves.toBe('# hello');
    await invoke(IpcChannels.workspaceWriteFile, 'README.md', '# updated');
    expect(workspace.writeFile).toHaveBeenCalledWith('README.md', '# updated');
    await expect(invoke(IpcChannels.workspaceGetRecent)).resolves.toEqual(['C:/project']);
    await expect(invoke(IpcChannels.workspaceAddRecent, 'C:/other')).resolves.toEqual(['C:/project']);
    await expect(invoke(IpcChannels.workspaceCreateFromTemplate, 'arduino-blink')).resolves.toBe(
      'C:/project',
    );
    expect(workspace.createFromTemplate).toHaveBeenCalledWith('arduino-blink');
  });

  it('forwards serial, flash, build, and port-mode events to the renderer', () => {
    const { sent, serial, flash, build, coordinator } = createHarness();
    serial.emitData?.('chunk');
    serial.emitStatus?.({ state: 'disconnected' });
    flash.emitProgress?.({ percent: 40 });
    flash.emitLog?.('writing');
    flash.emitDone?.({ ok: true });
    build.emitLog?.('compiling');
    coordinator.requestFlashing();

    expect(sent).toEqual(
      expect.arrayContaining([
        { channel: IpcChannels.serialData, payload: 'chunk' },
        { channel: IpcChannels.serialStatus, payload: { state: 'disconnected' } },
        { channel: IpcChannels.flashProgress, payload: { percent: 40 } },
        { channel: IpcChannels.flashLog, payload: 'writing' },
        { channel: IpcChannels.flashDone, payload: { ok: true } },
        { channel: IpcChannels.buildLog, payload: 'compiling' },
        { channel: IpcChannels.appPortMode, payload: 'flashing' },
      ]),
    );
  });
});
