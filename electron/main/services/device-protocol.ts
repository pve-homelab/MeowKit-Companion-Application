import type { RebootDownloadResult } from '../../../shared/ipc';
import {
  SOFT_ENTRY_ACK,
  SOFT_ENTRY_COMMAND,
  SOFT_ENTRY_TIMEOUT_MS,
} from '../../../shared/protocol';

export interface SerialTransport {
  isConnected(): boolean;
  write(data: string): Promise<void>;
  readLine(timeoutMs: number): Promise<string | null>;
}

export async function rebootToDownloadMode(
  transport: SerialTransport,
): Promise<RebootDownloadResult> {
  if (!transport.isConnected()) {
    return { ok: false, reason: 'not-connected' };
  }
  try {
    await transport.write(SOFT_ENTRY_COMMAND);
    const line = await transport.readLine(SOFT_ENTRY_TIMEOUT_MS);
    if (line?.trim() === SOFT_ENTRY_ACK) return { ok: true };
    return { ok: false, reason: 'unsupported' };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
