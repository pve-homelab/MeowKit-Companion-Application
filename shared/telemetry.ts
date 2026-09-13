/** Reserved Companion ↔ firmware telemetry framing (stock firmware may ignore). */
export const STATUS_QUERY_COMMAND = 'MK+STATUS?\n';
export const STATUS_LINE_PREFIX = 'MK+STATUS ';
export const TELEMETRY_TIMEOUT_MS = 1500;

export interface DeviceTelemetry {
  firmware?: string;
  battery?: number;
  sdUsedMb?: number;
  sdTotalMb?: number;
  wifi?: boolean;
  bt?: boolean;
}

export function parseStatusLine(line: string): DeviceTelemetry | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(STATUS_LINE_PREFIX)) return null;
  const json = trimmed.slice(STATUS_LINE_PREFIX.length);
  try {
    const data = JSON.parse(json) as DeviceTelemetry;
    return data;
  } catch {
    return null;
  }
}
