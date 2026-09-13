import type {
  DeviceManagerDevice,
  DeviceManagerStatus,
} from '@meowkit/components/device-manager-panel';
import type { SerialPortInfo, SerialStatus } from '../../shared/ipc';
import type { MeowKitBridge } from '../meowkit';
import { SERIAL_BAUD } from './serialConsole';

export type SerialApi = MeowKitBridge['serial'];

export interface DeviceManagerState {
  ports: SerialPortInfo[];
  connectedPath?: string;
  selectedId?: string;
  status: DeviceManagerStatus;
  errorMessage?: string;
  devices: DeviceManagerDevice[];
}

export const INITIAL_DEVICE_MANAGER_STATE: DeviceManagerState = {
  ports: [],
  status: 'idle',
  devices: [],
};

export function portsToDevices(
  ports: SerialPortInfo[],
  connectedPath?: string,
): DeviceManagerDevice[] {
  return ports.map((port) => ({
    id: port.path,
    name: port.friendlyName || port.path,
    status: port.path === connectedPath ? 'connected' : 'disconnected',
  }));
}

function withDevices(state: Omit<DeviceManagerState, 'devices'>): DeviceManagerState {
  return {
    ...state,
    devices: portsToDevices(state.ports, state.connectedPath),
  };
}

export function createDeviceManagerController(
  serial: SerialApi,
  emit: (state: DeviceManagerState) => void,
) {
  let state = withDevices({ ...INITIAL_DEVICE_MANAGER_STATE });

  function setState(patch: Partial<Omit<DeviceManagerState, 'devices'>>): void {
    state = withDevices({ ...state, ...patch });
    emit(state);
  }

  const offStatus = serial.onStatus((status: SerialStatus) => {
    switch (status.state) {
      case 'connected':
        setState({
          connectedPath: status.path,
          selectedId: status.path,
          status: 'success',
          errorMessage: undefined,
        });
        return;
      case 'disconnected':
        setState({ connectedPath: undefined, status: 'idle', errorMessage: undefined });
        return;
      case 'reconnecting':
        setState({ connectedPath: undefined, selectedId: status.path, status: 'busy' });
        return;
      case 'error':
        setState({ status: 'error', errorMessage: status.message });
        return;
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  });

  return {
    getState: () => state,
    select(id: string) {
      setState({ selectedId: id });
    },
    async refresh() {
      setState({ status: 'busy', errorMessage: undefined });
      try {
        const ports = await serial.listPorts();
        setState({ ports, status: 'idle' });
      } catch (err) {
        setState({
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    },
    async connect() {
      const path = state.selectedId;
      if (!path) return;
      setState({ status: 'busy', errorMessage: undefined });
      try {
        await serial.connect({ path, baudRate: SERIAL_BAUD });
      } catch (err) {
        setState({
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    },
    async disconnect() {
      setState({ status: 'busy', errorMessage: undefined });
      try {
        await serial.disconnect();
      } catch (err) {
        setState({
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    },
    dispose() {
      offStatus();
    },
  };
}
