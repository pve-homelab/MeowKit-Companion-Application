import { SerialPort } from 'serialport';
import type { FlashNodePort, FlashPortFactory } from './services/flash-service';
import type { ListedSerialPort, SerialPortFactory, SerialPortLike } from './services/serial-service';

async function listPorts(): Promise<ListedSerialPort[]> {
  const ports = await SerialPort.list();
  return ports.map((port) => {
    const extra = port as typeof port & { friendlyName?: string };
    const info: ListedSerialPort = {
      path: extra.path,
      friendlyName: extra.friendlyName || extra.manufacturer || extra.path,
    };
    if (extra.vendorId) info.vendorId = extra.vendorId;
    if (extra.productId) info.productId = extra.productId;
    return info;
  });
}

export function createSerialPortFactory(): SerialPortFactory {
  return {
    create({ path, baudRate }): SerialPortLike {
      const port = new SerialPort({ path, baudRate, autoOpen: false });
      return {
        get isOpen() {
          return port.isOpen;
        },
        open: () =>
          new Promise<void>((resolve, reject) => {
            port.open((err) => (err ? reject(err) : resolve()));
          }),
        close: () =>
          new Promise<void>((resolve, reject) => {
            port.close((err) => (err ? reject(err) : resolve()));
          }),
        write: (data, cb) => {
          port.write(data, cb);
        },
        on: (event, listener) => {
          port.on(event, listener);
        },
        removeAllListeners: () => {
          port.removeAllListeners();
        },
      } as SerialPortLike;
    },
    list: listPorts,
  };
}

export function createFlashPortFactory(): FlashPortFactory {
  return {
    create({ path, baudRate }): FlashNodePort {
      return new SerialPort({ path, baudRate, autoOpen: false }) as unknown as FlashNodePort;
    },
    list: listPorts,
  };
}
