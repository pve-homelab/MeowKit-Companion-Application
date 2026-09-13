import { describe, expect, it, vi } from 'vitest';
import { queryDeviceTelemetry } from '../electron/main/services/device-telemetry';
import { STATUS_LINE_PREFIX, STATUS_QUERY_COMMAND } from '../shared/telemetry';

describe('queryDeviceTelemetry', () => {
  it('returns not-connected when transport disconnected', async () => {
    const result = await queryDeviceTelemetry({
      isConnected: () => false,
      write: vi.fn(),
      readLine: vi.fn(),
    });
    expect(result).toEqual({ ok: false, reason: 'not-connected' });
  });

  it('returns unsupported when STATUS line never arrives (stock firmware)', async () => {
    const write = vi.fn(async () => undefined);
    const result = await queryDeviceTelemetry({
      isConnected: () => true,
      write,
      readLine: async () => null,
    });
    expect(write).toHaveBeenCalledWith(STATUS_QUERY_COMMAND);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('returns unsupported when response is not MK+STATUS JSON', async () => {
    const result = await queryDeviceTelemetry({
      isConnected: () => true,
      write: vi.fn(async () => undefined),
      readLine: async () => 'MK+OK REBOOT_DL',
    });
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('returns ok with parsed telemetry when STATUS line matches', async () => {
    const payload = {
      firmware: '1.0.0',
      battery: 85,
      sdUsedMb: 120,
      sdTotalMb: 8192,
      wifi: true,
      bt: false,
    };
    const result = await queryDeviceTelemetry({
      isConnected: () => true,
      write: vi.fn(async () => undefined),
      readLine: async () => `${STATUS_LINE_PREFIX}${JSON.stringify(payload)}`,
    });
    expect(result).toEqual({ ok: true, telemetry: payload });
  });
});
