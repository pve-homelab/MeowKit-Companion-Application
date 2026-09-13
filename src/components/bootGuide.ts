export const BOOT_STEPS = [
  'Power off the MeowKit.',
  'Hold BOOT with a Dupont wire on the BOOT pad.',
  'Power on for 1–2 seconds while BOOT is held.',
  'Connect USB.',
  'Select the port named USB JTAG/serial debug unit.',
] as const;

export const MICROSD_NOTE =
  'Erase writes internal flash and NVS only. It does not affect files on the microSD card.';

export const BOOT_CONFIRM_LABEL = 'Device is in download mode';
