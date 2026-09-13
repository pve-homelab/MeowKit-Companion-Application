# Milestone A — Real USB validation

Prove Electron serial + flash on a physical MeowKit before device telemetry / marketplace / IDE toolchain work.

## Prerequisites

- Prefer **`npx pnpm@9.15.0 dev`** for hardware testing (avoids OneDrive locking packaged `release/` folders).
- Or rebuilt unpacked exe if packaging succeeds: `release/win-unpacked/MeowKit Companion.exe`
- USB **data** cable, MeowKit charged ≥30%
- Close PlatformIO Serial Monitor / browser installer / other Companion windows
- Confirm DevTools has no white screen; `window.meowkit` should exist (preload `index.mjs` fix)

## Serial (B)

1. Launch unpacked exe (not an old installer build).
2. Open **Device** → **Refresh** → select CDC / MeowKit port.
3. **Connect** → open **Serial**.
4. Send a line; confirm echo/logs @ 115200.
5. Unplug/replug; confirm reconnect / status updates.

## Flash (C)

1. Open **Flash** → choose bundled **v1.0.0**.
2. Soft-entry will report **unsupported** on stock firmware → follow BOOT guide.
3. Select port named like `USB JTAG/serial debug unit`.
4. Flash with optional erase; confirm progress/logs and device boots.
5. Confirm microSD files unchanged after erase.

## Pass criteria

- [ ] Serial send/receive works
- [ ] Factory image flashes via BOOT fallback
- [ ] No white screen (preload loads)
- [ ] Ready for telemetry protocol experiments on Device tab

## After pass → later milestones

Device telemetry (battery/SD/Wi‑Fi/BT) → Apps install via MSC → IDE workspace/toolchain → rest of 10-item brainstorm.
