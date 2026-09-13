# Companion B→C — Manual smoke checklist

Date: 2026-09-13  
Hardware required: MeowKit ESP32-S3, USB data cable  
Network: optional (flash must work in airplane mode after `fetch-firmware`)

## Setup

- [ ] Clone repo and `vendor/MeowKit-React-Library`
- [ ] `npx pnpm@9.15.0 install` + `--filter @meowkit/components... build`
- [ ] `npx pnpm@9.15.0 fetch-firmware`
- [ ] `npx pnpm@9.15.0 dev` — app opens with MeowKit shell

## Serial (B)

- [ ] **List ports** — Device or Serial view shows at least one USB serial entry when MeowKit is connected
- [ ] **Connect @ 115200** — status shows connected; no other serial monitor holds the port
- [ ] **Receive data** — device boot log or prompt lines appear in console
- [ ] **Send line** — typed input reaches device (echo, response, or visible effect)
- [ ] **Reconnect** — unplug USB briefly; UI shows disconnected/reconnecting; replug restores without restarting the app

## Flash (C)

- [ ] **Bundled image** — Flash panel lists official v1.0.0 from `resources/firmware`
- [ ] **Soft-entry stub** — starting flash on stock firmware triggers BOOT guide (`unsupported` is expected)
- [ ] **BOOT fallback** — follow guide: power off, hold BOOT (Dupont), power on, connect USB, confirm ready
- [ ] **JTAG port** — select port named like `USB JTAG/serial debug unit` (pick manually if OS label differs)
- [ ] **Factory flash** — progress bar and logs stream; completes successfully offline (disable Wi‑Fi to verify)
- [ ] **Device boots** — after flash, power cycle if needed; device runs flashed firmware
- [ ] **Custom `.bin`** (optional) — pick a user file and flash with same BOOT flow
- [ ] **Erase option** (optional) — enable erase, flash factory image; **microSD contents unchanged** afterward

## Regression / safety

- [ ] Close PlatformIO monitor, web installer, or second Companion window before flash (port busy)
- [ ] Flash failure shows safe-retry copy (power off → BOOT → retry); no “permanently damaged” messaging
- [ ] Serial blocked while flash is in progress (`flashing` port mode)

## Sign-off

| Check | Pass | Notes |
|-------|------|-------|
| Serial B | ☐ | |
| Flash C (BOOT) | ☐ | |
| Offline flash | ☐ | |
| SD safe after erase | ☐ | |

Tester: _______________  
Date: _______________  
Firmware on device (before/after): _______________
