# MeowKit Companion App — Milestone B→C Design

Date: 2026-09-13  
Status: Approved for planning (architecture, modules, IPC)  
Scope: Electron shell + MeowKit UI + real serial console (B), then offline firmware flashing (C)

## Context

This repository implements the MeowKit Companion App + MeowKitIDE described in `PROMPT.md`. Full product scope (marketplace, MSC storage, IDE toolchains, auto-update) is too large for one cycle. First delivery is **B then C**.

Visual UI comes from the unofficial [MeowKit React Library](https://github.com/pve-homelab/MeowKit-React-Library) (design tokens, components, companion/IDE panels). Device behavior is grounded in official sources:

- [MeowKit docs](https://docs.meowkit.cc/) / [docs repo](https://github.com/mingolucky/meowkit-s3-docs)
- [Web installer](https://github.com/mingolucky/meowkit-s3-installer) + [download page](https://meowkit.cc/pages/download)
- [Firmware](https://github.com/mingolucky/meowkit-s3-firmware)

### Device facts that constrain this design

| Fact | Implication |
| --- | --- |
| ESP32-S3-WROOM-1-N16R8, 16 MB flash | Flash target chip family `ESP32-S3` |
| Native USB OTG (CDC, JTAG, MSC, download) | Prefer port labeled `USB JTAG/serial debug unit` for flash |
| One USB-C port; modes are exclusive | Serial and flash must not share the port concurrently |
| Official flash: manual BOOT + power → download mode | Soft auto-entry may fail on stock firmware |
| Official image: single factory `.bin` at offset `0` | Match installer `stable/manifest.json` layout |
| CDC monitor baud 115200 (`platformio.ini`) | Default serial baud |
| Flash does not touch microSD | Flash UI must not imply SD wipe; erase = internal flash/NVS only |
| USB MSC is a separate device mode (Settings) | MSC storage is out of scope for B→C |

## Goals

1. **B — Serial:** Connect to MeowKit CDC, send/receive lines, baud selection (default 115200), auto-reconnect, status in UI.
2. **C — Flash:** Offline flash of bundled official factory firmware and user-selected custom `.bin`s via esptool-js in the Electron main process, with progress/logs and safe error recovery.
3. **Soft-entry protocol:** Define `rebootToDownloadMode` over USB/serial for a future firmware command; **do not modify official firmware** in this milestone. Until supported, use guided BOOT fallback (documented user flow).
4. **Offline-first:** Serial and flash work with no network. Bundle at least official `v1.0.0` factory image + SHA256.
5. **UI fidelity:** All surfaces use `@meowkit/*` components so the app matches MeowKit visual style.

## Non-goals (B→C)

- Official firmware patches or forks
- App marketplace / install-to-device pipeline
- SD card / USB MSC file manager
- Real ESP-IDF / Arduino / MeowKit build toolchains (IDE build buttons may stub)
- Companion app auto-update
- Optional online firmware sync catalogs

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Renderer (React + @meowkit/*)                               │
│  AppLayout / DeviceManager / SerialConsole / Flash panel    │
│  Monaco IDE shell (scaffold)                                │
└────────────────────────────┬────────────────────────────────┘
                             │ preload: window.meowkit.*
┌────────────────────────────▼────────────────────────────────┐
│ Electron main                                               │
│  SerialService │ FlashService │ FirmwareStore │ DeviceProtocol │
│  Port exclusivity coordinator                               │
└────────────────────────────┬────────────────────────────────┘
                             │
                    USB CDC / USB-JTAG (device)
```

- **Main process** owns serial I/O, flashing, firmware files, and port exclusivity.
- **Preload** exposes a typed, narrow IPC API; renderer has no Node/serialport access.
- **Renderer** is presentational + view state; MeowKit panels stay callback-driven.

### Stack choices

| Concern | Choice |
| --- | --- |
| Desktop shell | Electron + Vite |
| UI | Git dependency on `pve-homelab/MeowKit-React-Library` (`@meowkit/design-tokens`, `@meowkit/global-styles`, `@meowkit/components`) |
| Serial | `serialport` in main |
| Flash | `esptool-js` in main (no Python runtime) |
| Official image format | Factory merged bin @ `0x0`, chipFamily `ESP32-S3` |

## Module layout

```
electron/
  main/          # window, lifecycle, services, IPC handlers
  preload/       # contextBridge → window.meowkit
src/             # React renderer
resources/
  firmware/      # bundled official bins + SHA256SUMS
docs/superpowers/
  specs/         # this design
  plans/         # implementation plan (next)
```

### Main-process services

- **SerialService** — enumerate ports; connect/disconnect; read/write; auto-reconnect with backoff; emit data/status.
- **FlashService** — claim port exclusively; optional soft-entry; run esptool-js write; stream progress/logs; cancel; release port.
- **FirmwareStore** — list bundled images; verify SHA256 when known; remember recent custom paths; open file dialog for custom `.bin`.
- **DeviceProtocol** — when serial-connected, attempt `rebootToDownloadMode`; return `unsupported` on stock firmware (expected).
- **PortCoordinator** — single owner of “current mode”: `idle` | `serial` | `flashing`. Starting flash disconnects serial and blocks reconnect until flash completes or cancels.

### Renderer surfaces

| Surface | MeowKit building blocks | Behavior in B→C |
| --- | --- | --- |
| Shell | `MeowKitProvider`, `AppLayout`, `Sidebar`, `StatusBar` | Navigation between Device / Serial / Flash / IDE |
| IDE scaffold | `IDEToolbar`, `FileExplorerTree`, `MonacoEditor`, `BuildOutputPanel` | Local mock/stub handlers OK; no real toolchain yet |
| Serial | `SerialConsoleView` | Live IPC wire-up |
| Flash | `FirmwareFlashingPanel` (+ guided BOOT steps UI) | Live IPC wire-up |
| Device | `DeviceManagerPanel` | Port list, connection state, quick actions |

## IPC contract (`window.meowkit`)

### Serial

- `serial.listPorts()` → `{ path, friendlyName, vendorId?, productId? }[]`
- `serial.connect({ path, baudRate })` / `serial.disconnect()` / `serial.write(data: string | Uint8Array)`
- Events: `serial.onData`, `serial.onStatus` (`connected` | `disconnected` | `reconnecting` | `error`)

### Flash

- `flash.getImages()` → bundled + recent custom entries (`id`, `label`, `version?`, `path`, `sha256?`, `source: 'bundled' | 'custom'`)
- `flash.pickCustomImage()` → file dialog result or cancel
- `flash.start({ imageId?, path?, erase: boolean })` / `flash.cancel()`
- Events: `flash.onProgress` (`percent`, `bytesWritten?`), `flash.onLog` (line), `flash.onDone` (`ok`, `error?`)

### Device protocol

- `device.rebootToDownloadMode()` →  
  `{ ok: true } | { ok: false, reason: 'unsupported' | 'not-connected' | 'error', message?: string }`

### Status

- `app.getPortMode()` / `app.onPortMode` → `idle` | `serial` | `flashing` for status bar

## Data flows

### Serial (B)

1. User opens Device/Serial → `listPorts()`.
2. User selects port (prefer CDC / MeowKit-looking entries) → `connect({ baudRate: 115200 })`.
3. Incoming bytes → `onData` → `SerialConsoleView` lines.
4. User send → `write` → device.
5. Unexpected disconnect → auto-reconnect attempts while mode is `serial`; surface status in StatusBar.

### Flash (C)

1. `getImages()` shows bundled `v1.0.0` (+ customs).
2. User chooses image + optional erase → `start`.
3. PortCoordinator switches to `flashing` (disconnects serial if needed).
4. Call `rebootToDownloadMode` if serial was up / protocol reachable:
   - `unsupported` → show guided BOOT steps (power off, hold BOOT via Dupont, power on, connect USB, select USB JTAG port) → user confirms ready.
   - `ok` → proceed when download-mode port appears.
5. Open port → esptool-js write bin at `0x0` → progress/logs.
6. On success: mark done; if device does not reset, instruct disconnect USB and power on normally.
7. On interrupt/failure: instruct power off → BOOT → retry (aligned with official docs). Never claim the device is permanently damaged.

### Soft-entry protocol (stub)

- Companion defines a stable command framing for future firmware (exact bytes/ASCII to be finalized in implementation plan; must be documented as “reserved”).
- Stock firmware: always treat as `unsupported` until a future firmware release opts in.
- No changes to [meowkit-s3-firmware](https://github.com/mingolucky/meowkit-s3-firmware) in this milestone.

## Offline firmware packaging

- Bundle at least: `resources/firmware/v1.0.0/meowkit-s3-v1.0.0-factory.bin` and `SHA256SUMS.txt` matching the official installer artifact (`f4f44fe9…` for v1.0.0).
- Custom images: user-selected `.bin`; no checksum required; warn that offsets/layout are user responsibility; default write still `@ 0x0` unless later extended.
- Erase option maps to full chip erase before write (same user meaning as installer “Erase device”: internal flash/settings, not microSD).

## Error handling (user-visible)

| Condition | UX |
| --- | --- |
| No ports | Cable/data/hub hints from official troubleshooting |
| Wrong port | Hint to pick `USB JTAG/serial debug unit` for flash |
| Port busy / permission | Close other monitors (PlatformIO, web installer, another Companion window) |
| Soft-entry unsupported | Expected; show BOOT guide |
| Bundled checksum mismatch | Block flash; report corrupt resource |
| Flash mid-fail | Safe retry with BOOT; keep logs |

## Testing strategy

- **Unit:** FirmwareStore checksum verification; IPC payload types; DeviceProtocol returns `unsupported` without a matching reply; PortCoordinator exclusivity transitions.
- **Integration (mocked native):** Serial connect → write → onData; flash start → progress → done; serial blocked during flash.
- **Manual hardware smoke:** CDC console @ 115200; factory image flash with BOOT fallback; confirm SD contents untouched after erase+flash.

## Success criteria

1. App launches with MeowKit-themed shell offline.
2. User can list ports, connect, send/receive on serial, and see reconnect behavior.
3. User can flash bundled official factory firmware offline with progress/logs using BOOT fallback.
4. User can select a custom `.bin` and flash it the same way.
5. Soft-entry API exists and reports `unsupported` cleanly on stock firmware.
6. No network required for the above.

## Follow-on (after B→C)

- Marketplace, MSC/SD manager, real IDE toolchains, auto-update
- Soft-entry activation when/if official firmware adds the command
- Optional online catalog sync of newer official images (cache still offline-usable)
