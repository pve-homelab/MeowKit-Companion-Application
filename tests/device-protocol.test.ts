import { describe, expect, it, vi } from 'vitest';
import { rebootToDownloadMode } from '../electron/main/services/device-protocol';
import { SOFT_ENTRY_ACK, SOFT_ENTRY_COMMAND } from '../shared/protocol';

describe('rebootToDownloadMode', () => {
  it('returns not-connected when transport disconnected', async () => {
    const result = await rebootToDownloadMode({
      isConnected: () => false,
      write: vi.fn(),
      readLine: vi.fn(),
    });
    expect(result).toEqual({ ok: false, reason: 'not-connected' });
  });

  it('returns unsupported when ACK never arrives (stock firmware)', async () => {
    const write = vi.fn(async () => undefined);
    const result = await rebootToDownloadMode({
      isConnected: () => true,
      write,
      readLine: async () => null,
    });
    expect(write).toHaveBeenCalledWith(SOFT_ENTRY_COMMAND);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('returns ok when ACK matches', async () => {
    const result = await rebootToDownloadMode({
      isConnected: () => true,
      write: vi.fn(async () => undefined),
      readLine: async () => SOFT_ENTRY_ACK,
    });
    expect(result).toEqual({ ok: true });
  });
});
