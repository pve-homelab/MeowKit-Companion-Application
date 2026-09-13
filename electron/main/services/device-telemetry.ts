import type { DeviceTelemetryResult } from '../../../shared/ipc';
import {
  STATUS_QUERY_COMMAND,
  TELEMETRY_TIMEOUT_MS,
  parseStatusLine,
} from '../../../shared/telemetry';
import type { SerialTransport } from './device-protocol';

export async function queryDeviceTelemetry(
  transport: SerialTransport,
): Promise<DeviceTelemetryResult> {
  if (!transport.isConnected()) {
    return { ok: false, reason: 'not-connected' };
  }
  try {
    await transport.write(STATUS_QUERY_COMMAND);
    const line = await transport.readLine(TELEMETRY_TIMEOUT_MS);
    const telemetry = line ? parseStatusLine(line) : null;
    if (telemetry) return { ok: true, telemetry };
    return { ok: false, reason: 'unsupported' };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
