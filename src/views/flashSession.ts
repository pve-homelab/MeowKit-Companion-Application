import type { FirmwareFlashingStatus } from '@meowkit/components/firmware-flashing-panel';
import type { FirmwareImage, FlashDone, SerialPortInfo } from '../../shared/ipc';
import type { MeowKitBridge } from '../meowkit';

export const JTAG_LABEL = /usb jtag\/serial debug unit/i;

export const SAFE_RETRY_COPY =
  'Flash did not finish. Power off the device, enter BOOT mode, and retry. The device is not permanently damaged.';

export const FLASH_SUCCESS_COPY =
  'Flash complete. If the device does not restart, disconnect USB and power on normally.';

export const NO_JTAG_PORT_COPY =
  'Select the port named USB JTAG/serial debug unit.';

export const CUSTOM_IMAGE_WARNING =
  'Custom images write at address 0x0. You are responsible for the flash layout.';

export type FlashApi = MeowKitBridge['flash'];
export type SerialApi = MeowKitBridge['serial'];
export type DeviceApi = MeowKitBridge['device'];

export interface FlashSessionApis {
  serial: SerialApi;
  flash: FlashApi;
  device: DeviceApi;
}

export interface FlashSessionState {
  images: FirmwareImage[];
  selectedImageId?: string;
  ports: SerialPortInfo[];
  selectedPortPath?: string;
  deviceName: string;
  status: FirmwareFlashingStatus;
  progress: number;
  logs: string[];
  confirmErase: boolean;
  showBootGuide: boolean;
  errorMessage?: string;
  resultMessage?: string;
}

export function selectedImageIsCustom(state: FlashSessionState): boolean {
  return state.images.find((image) => image.id === state.selectedImageId)?.source === 'custom';
}

export const INITIAL_FLASH_SESSION_STATE: FlashSessionState = {
  images: [],
  ports: [],
  deviceName: 'No device',
  status: 'idle',
  progress: 0,
  logs: [],
  confirmErase: false,
  showBootGuide: false,
};

export function preferJtagPort(ports: SerialPortInfo[]): SerialPortInfo | undefined {
  return ports.find((port) => JTAG_LABEL.test(port.friendlyName));
}

export function pickFlashPortPath(ports: SerialPortInfo[], selected?: string): string | undefined {
  if (selected && ports.some((port) => port.path === selected)) return selected;
  return preferJtagPort(ports)?.path;
}

function deviceNameFor(ports: SerialPortInfo[], path?: string): string {
  if (!path) return 'No device';
  return ports.find((port) => port.path === path)?.friendlyName || path;
}

export function createFlashSessionController(
  apis: FlashSessionApis,
  emit: (state: FlashSessionState) => void,
) {
  const { serial, flash, device } = apis;
  let state: FlashSessionState = { ...INITIAL_FLASH_SESSION_STATE, logs: [] };

  function setState(patch: Partial<FlashSessionState>): void {
    state = { ...state, ...patch };
    emit(state);
  }

  function failNoJtag(ports: SerialPortInfo[]): void {
    setState({
      ports,
      selectedPortPath: undefined,
      deviceName: 'No device',
      status: 'error',
      errorMessage: NO_JTAG_PORT_COPY,
    });
  }

  async function refreshPorts(): Promise<SerialPortInfo[]> {
    const ports = await serial.listPorts();
    return ports;
  }

  async function startFlash(portPath: string, ports: SerialPortInfo[]): Promise<void> {
    const imageId = state.selectedImageId;
    if (!imageId) {
      setState({ status: 'error', errorMessage: 'No firmware image selected.' });
      return;
    }
    setState({
      ports,
      selectedPortPath: portPath,
      deviceName: deviceNameFor(ports, portPath),
      status: 'busy',
      showBootGuide: false,
      errorMessage: undefined,
      resultMessage: undefined,
      progress: 0,
    });
    try {
      await flash.start({ imageId, erase: state.confirmErase, portPath });
    } catch (err) {
      if (state.status !== 'busy') return;
      const line = err instanceof Error ? err.message : String(err);
      setState({
        status: 'error',
        errorMessage: SAFE_RETRY_COPY,
        logs: [...state.logs, line],
      });
    }
  }

  const offProgress = flash.onProgress((p) => {
    setState({ progress: p.percent });
  });

  const offLog = flash.onLog((line) => {
    setState({ logs: [...state.logs, line] });
  });

  const offDone = flash.onDone((done: FlashDone) => {
    if (done.ok) {
      setState({
        status: 'success',
        progress: 100,
        errorMessage: undefined,
        resultMessage: FLASH_SUCCESS_COPY,
      });
      return;
    }
    setState({
      status: 'error',
      errorMessage: SAFE_RETRY_COPY,
      logs: done.error ? [...state.logs, done.error] : state.logs,
    });
  });

  return {
    getState: () => state,
    selectImage(id: string) {
      setState({ selectedImageId: id });
    },
    selectPort(path: string) {
      setState({
        selectedPortPath: path,
        deviceName: deviceNameFor(state.ports, path),
      });
    },
    setConfirmErase(confirmErase: boolean) {
      setState({ confirmErase });
    },
    async loadImages() {
      const images = await flash.getImages();
      setState({
        images,
        selectedImageId: images[0]?.id ?? state.selectedImageId,
      });
    },
    async pickCustomImage() {
      const image = await flash.pickCustomImage();
      if (!image) return;
      const images = state.images.some((existing) => existing.id === image.id)
        ? state.images.map((existing) => (existing.id === image.id ? image : existing))
        : [...state.images, image];
      setState({ images, selectedImageId: image.id });
    },
    async connect() {
      const ports = await refreshPorts();
      const portPath = pickFlashPortPath(ports, state.selectedPortPath);
      setState({
        ports,
        selectedPortPath: portPath,
        deviceName: deviceNameFor(ports, portPath),
        errorMessage: undefined,
      });
    },
    async flash() {
      if (state.status === 'busy') return;
      setState({ status: 'busy', errorMessage: undefined, resultMessage: undefined });
      const reboot = await device.rebootToDownloadMode();
      if (!reboot.ok) {
        switch (reboot.reason) {
          case 'unsupported':
          case 'not-connected':
            setState({ status: 'idle', showBootGuide: true });
            return;
          case 'error':
            setState({
              status: 'error',
              errorMessage: reboot.message ?? SAFE_RETRY_COPY,
            });
            return;
          default: {
            const _exhaustive: never = reboot.reason;
            return _exhaustive;
          }
        }
      }
      const ports = await refreshPorts();
      const portPath = preferJtagPort(ports)?.path ?? pickFlashPortPath(ports, state.selectedPortPath);
      if (!portPath) {
        failNoJtag(ports);
        return;
      }
      await startFlash(portPath, ports);
    },
    async confirmBoot() {
      const ports = await refreshPorts();
      const portPath = preferJtagPort(ports)?.path ?? pickFlashPortPath(ports, state.selectedPortPath);
      if (!portPath) {
        failNoJtag(ports);
        return;
      }
      await startFlash(portPath, ports);
    },
    async cancel() {
      await flash.cancel();
    },
    dispose() {
      offProgress();
      offLog();
      offDone();
    },
  };
}
