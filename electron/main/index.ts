import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { registerIpc } from './ipc';
import { firmwareRoot } from './path';
import { createFlashPortFactory, createSerialPortFactory } from './serial-port-factory';
import { FlashService, createEspToolFlashBinary } from './services/flash-service';
import { FirmwareStore } from './services/firmware-store';
import { PortCoordinator } from './services/port-coordinator';
import { SerialService } from './services/serial-service';

function createServices() {
  const coordinator = new PortCoordinator();
  const serial = new SerialService(coordinator, createSerialPortFactory());
  const store = new FirmwareStore(firmwareRoot());
  const flash = new FlashService(
    coordinator,
    store,
    serial,
    createEspToolFlashBinary(createFlashPortFactory()),
  );
  return { coordinator, serial, flash, store };
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
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

app.whenReady().then(() => {
  const services = createServices();
  const win = createWindow();
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
  });
});
