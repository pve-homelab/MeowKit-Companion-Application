import { describe, expect, it } from 'vitest';
import {
  BOOT_CONFIRM_LABEL,
  BOOT_STEPS,
  MICROSD_NOTE,
} from '../src/components/bootGuide';

describe('BOOT guide copy', () => {
  it('lists official BOOT steps in order', () => {
    expect(BOOT_STEPS).toEqual([
      'Power off the MeowKit.',
      'Hold BOOT with a Dupont wire on the BOOT pad.',
      'Power on for 1–2 seconds while BOOT is held.',
      'Connect USB.',
      'Select the port named USB JTAG/serial debug unit.',
    ]);
  });

  it('notes that erase does not affect microSD', () => {
    expect(MICROSD_NOTE).toMatch(/erase/i);
    expect(MICROSD_NOTE).toMatch(/microSD/i);
    expect(MICROSD_NOTE).toMatch(/does not affect/i);
  });

  it('uses Device is in download mode as the confirm label', () => {
    expect(BOOT_CONFIRM_LABEL).toBe('Device is in download mode');
  });
});
