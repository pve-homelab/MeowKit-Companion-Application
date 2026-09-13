import type { KeyValuePair } from '@meowkit/components/key-value-pairs';
import type { DeviceTelemetry } from '../../shared/ipc';

export const TELEMETRY_PLACEHOLDER = '—';

function formatBattery(battery?: number): string {
  if (battery === undefined) return TELEMETRY_PLACEHOLDER;
  return `${battery}%`;
}

function formatSdCard(sdUsedMb?: number, sdTotalMb?: number): string {
  if (sdUsedMb === undefined && sdTotalMb === undefined) return TELEMETRY_PLACEHOLDER;
  if (sdUsedMb !== undefined && sdTotalMb !== undefined) {
    return `${sdUsedMb} / ${sdTotalMb} MB`;
  }
  if (sdUsedMb !== undefined) return `${sdUsedMb} MB used`;
  return `${sdTotalMb} MB total`;
}

function formatRadio(enabled?: boolean): string {
  if (enabled === undefined) return TELEMETRY_PLACEHOLDER;
  return enabled ? 'On' : 'Off';
}

function formatFirmware(firmware?: string): string {
  return firmware ?? TELEMETRY_PLACEHOLDER;
}

export function buildTelemetryCards(telemetry?: DeviceTelemetry): KeyValuePair[] {
  return [
    { label: 'Battery', value: formatBattery(telemetry?.battery) },
    { label: 'SD card', value: formatSdCard(telemetry?.sdUsedMb, telemetry?.sdTotalMb) },
    { label: 'Wi-Fi', value: formatRadio(telemetry?.wifi) },
    { label: 'Bluetooth', value: formatRadio(telemetry?.bt) },
    { label: 'Firmware', value: formatFirmware(telemetry?.firmware) },
  ];
}
