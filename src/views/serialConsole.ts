import type { SerialConsoleLine } from '@meowkit/components/serial-console-view';
import type { SerialPortInfo, SerialStatus } from '../../shared/ipc';
import type { MeowKitBridge } from '../meowkit';

export const SERIAL_BAUD = 115200;

export type SerialApi = MeowKitBridge['serial'];

export interface PortSelectOption {
  value: string;
  label: string;
}

export interface SerialConsoleState {
  ports: SerialPortInfo[];
  selectedPath?: string;
  connected: boolean;
  lines: SerialConsoleLine[];
}

export const INITIAL_SERIAL_CONSOLE_STATE: SerialConsoleState = {
  ports: [],
  connected: false,
  lines: [],
};

export function portsToSelectOptions(ports: SerialPortInfo[]): PortSelectOption[] {
  return ports.map((port) => ({
    value: port.path,
    label: port.friendlyName || port.path,
  }));
}

export function encodeSerialWrite(line: string): string {
  return `${line}\n`;
}

export function lineFromData(id: string, chunk: string): SerialConsoleLine {
  return { id, text: chunk, stream: 'stdout' };
}

export function lineFromStatus(id: string, status: SerialStatus): SerialConsoleLine | undefined {
  switch (status.state) {
    case 'reconnecting':
      return {
        id,
        text: `Reconnecting to ${status.path} (attempt ${status.attempt})`,
        stream: 'system',
      };
    case 'error':
      return { id, text: status.message, stream: 'system' };
    case 'connected':
    case 'disconnected':
      return undefined;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function createSerialConsoleController(
  serial: SerialApi,
  emit: (state: SerialConsoleState) => void,
) {
  let nextId = 1;
  let state: SerialConsoleState = { ...INITIAL_SERIAL_CONSOLE_STATE, lines: [] };

  function setState(patch: Partial<SerialConsoleState>): void {
    state = { ...state, ...patch };
    emit(state);
  }

  function pushLine(line: SerialConsoleLine): void {
    setState({ lines: [...state.lines, line] });
  }

  function nextLineId(): string {
    return String(nextId++);
  }

  const offData = serial.onData((chunk) => {
    pushLine(lineFromData(nextLineId(), chunk));
  });

  const offStatus = serial.onStatus((status) => {
    switch (status.state) {
      case 'connected':
        setState({ connected: true, selectedPath: status.path });
        return;
      case 'disconnected':
        setState({ connected: false });
        return;
      case 'reconnecting': {
        const line = lineFromStatus(nextLineId(), status);
        setState({
          connected: false,
          selectedPath: status.path,
          lines: line ? [...state.lines, line] : state.lines,
        });
        return;
      }
      case 'error': {
        const line = lineFromStatus(nextLineId(), status);
        setState({
          connected: false,
          lines: line ? [...state.lines, line] : state.lines,
        });
        return;
      }
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  });

  return {
    getState: () => state,
    async refresh() {
      const ports = await serial.listPorts();
      setState({ ports });
    },
    async connect(path: string) {
      setState({ selectedPath: path });
      try {
        await serial.connect({ path, baudRate: SERIAL_BAUD });
      } catch (err) {
        pushLine({
          id: nextLineId(),
          text: err instanceof Error ? err.message : String(err),
          stream: 'system',
        });
        throw err;
      }
    },
    async send(line: string) {
      await serial.write(encodeSerialWrite(line));
    },
    clear() {
      setState({ lines: [] });
    },
    dispose() {
      offData();
      offStatus();
    },
  };
}
