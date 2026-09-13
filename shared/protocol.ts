/** Reserved Companion ↔ firmware soft-entry framing (stock firmware ignores). */
export const SOFT_ENTRY_COMMAND = 'MK+REBOOT_DL\n';
export const SOFT_ENTRY_ACK = 'MK+OK REBOOT_DL';
export const SOFT_ENTRY_TIMEOUT_MS = 1500;
