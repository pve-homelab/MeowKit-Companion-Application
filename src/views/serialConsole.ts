import type { SerialConsoleLine } from '@meowkit/components/serial-console-view';
import type { SerialPortInfo, SerialStatus } from '../../shared/ipc';
import type { MeowKitBridge } from '../meowkit';

export const SERIAL_BAUD = 115200;

export const SERIAL_BAUD_RATES = [115200, 921600, 9600] as const;

export type SerialBaudRate = (typeof SERIAL_BAUD_RATES)[number];

export type SerialApi = MeowKitBridge['serial'];

export interface PortSelectOption {
  value: string;
  label: string;
}

export interface SerialConsoleState {
  ports: SerialPortInfo[];
  selectedPath?: string;
  baudRate: SerialBaudRate;
  connected: boolean;
  lines: SerialConsoleLine[];
}

export const INITIAL_SERIAL_CONSOLE_STATE: SerialConsoleState = {
  ports: [],
  baudRate: SERIAL_BAUD,
  connected: false,
  lines: [],
};

export function baudRatesToSelectOptions(rates: readonly SerialBaudRate[] = SERIAL_BAUD_RATES): PortSelectOption[] {
  return rates.map((rate) => ({ value: String(rate), label: String(rate) }));
}

export function formatSerialLog(lines: SerialConsoleLine[]): string {
  return lines.map((line) => line.text).join('');
}

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

  function applyStatus(status: SerialStatus, extra?: Partial<SerialConsoleState>): void {
    switch (status.state) {
      case 'connected':
        setState({ ...extra, connected: true, selectedPath: status.path });
        return;
      case 'disconnected':
        setState({ ...extra, connected: false });
        return;
      case 'reconnecting': {
        const line = lineFromStatus(nextLineId(), status);
        setState({
          ...extra,
          connected: false,
          selectedPath: status.path,
          lines: extra?.lines ?? (line ? [...state.lines, line] : state.lines),
        });
        return;
      }
      case 'error': {
        const line = lineFromStatus(nextLineId(), status);
        setState({
          ...extra,
          connected: false,
          lines: extra?.lines ?? (line ? [...state.lines, line] : state.lines),
        });
        return;
      }
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  }

  const offStatus = serial.onStatus((status) => {
    applyStatus(status);
  });

  return {
    getState: () => state,
    async refresh() {
      const [ports, status] = await Promise.all([serial.listPorts(), serial.getStatus()]);
      applyStatus(status, { ports });
    },
    async connect(path: string, baudRate: SerialBaudRate = state.baudRate) {
      setState({ selectedPath: path, baudRate });
      try {
        await serial.connect({ path, baudRate });
      } catch (err) {
        pushLine({
          id: nextLineId(),
          text: err instanceof Error ? err.message : String(err),
          stream: 'system',
        });
        throw err;
      }
    },
    async setBaudRate(baudRate: SerialBaudRate) {
      setState({ baudRate });
      if (state.connected && state.selectedPath) {
        await this.connect(state.selectedPath, baudRate);
      }
    },
    async disconnect() {
      await serial.disconnect();
    },
    async send(line: string) {
      await serial.write(encodeSerialWrite(line));
    },
    async saveLog() {
      return serial.saveLog(formatSerialLog(state.lines));
    },
    async reset() {
      try {
        await serial.reset();
      } catch (err) {
        pushLine({
          id: nextLineId(),
          text: err instanceof Error ? err.message : String(err),
          stream: 'system',
        });
        throw err;
      }
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
