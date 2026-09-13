import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registerIpc } from './ipc';
import { appsCatalogRoot, appsStagingRoot, firmwareRoot } from './path';
import { AppsCatalogService } from './services/apps-catalog';
import { BuildService } from './services/build-service';
import { createFlashPortFactory, createSerialPortFactory } from './serial-port-factory';
import { FlashService, createEspToolFlashBinary } from './services/flash-service';
import { FirmwareStore } from './services/firmware-store';
import { PortCoordinator } from './services/port-coordinator';
import { SerialService } from './services/serial-service';
import { SettingsStore, createSettingsRecentStore } from './services/settings-store';
import { WorkspaceService } from './services/workspace-service';

function createServices(getWindow: () => BrowserWindow | null) {
  const coordinator = new PortCoordinator();
  const serial = new SerialService(coordinator, createSerialPortFactory());
  const store = new FirmwareStore(firmwareRoot());
  const flash = new FlashService(
    coordinator,
    store,
    serial,
    createEspToolFlashBinary(createFlashPortFactory()),
  );
  const userData = app.getPath('userData');
  const settings = new SettingsStore(userData);
  const apps = new AppsCatalogService(appsCatalogRoot(), appsStagingRoot(userData));
  const build = new BuildService(settings);
  const workspace = new WorkspaceService({
    recentStore: createSettingsRecentStore(settings),
    pickFolderDialog: async () => {
      const win = getWindow();
      const result = win
        ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
        : await dialog.showOpenDialog({ properties: ['openDirectory'] });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  });
  return { coordinator, serial, flash, store, workspace, settings, apps, build };
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // electron-vite emits ESM preload as index.mjs when package.json has "type": "module"
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return win;
}

function sendToRenderer(channel: string, payload: unknown): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  win?.webContents.send(channel, payload);
}

app.whenReady().then(async () => {
  let win: BrowserWindow | null = null;
  const services = createServices(() => win);
  await services.settings.load();
  win = createWindow();
  registerIpc({
    ipc: ipcMain,
    send: sendToRenderer,
    ...services,
    pickFirmwareFile: async () => {
      const result = await dialog.showOpenDialog(win, {
        title: 'Select firmware image',
        filters: [{ name: 'Firmware', extensions: ['bin'] }],
        properties: ['openFile'],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    saveSerialLog: async (content) => {
      const result = await dialog.showSaveDialog(win, {
        title: 'Save serial log',
        defaultPath: `serial-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`,
        filters: [{ name: 'Text', extensions: ['txt', 'log'] }],
      });
      if (result.canceled || !result.filePath) return false;
      await writeFile(result.filePath, content, 'utf8');
      return true;
    },
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
