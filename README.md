# MeowKit Companion Application

Offline Electron companion for MeowKit ESP32-S3 devices: live USB serial console, offline firmware flashing, and a MeowKitIDE scaffold. Milestone **B→C** delivers serial (B) and flash (C) with MeowKit UI components.

## Prerequisites

- **OS:** Windows, macOS, or Linux
- **Hardware:** MeowKit device and a USB **data** cable (charge-only cables will not enumerate)
- **Node.js:** 20+
- **pnpm:** 9 (`npx pnpm@9.15.0` on Windows if Corepack is unavailable)

## Quick start

```bash
git clone <this-repo-url>
cd MeowKit-Companion-Application

# MeowKit UI packages (required before install)
git clone https://github.com/pve-homelab/MeowKit-React-Library.git vendor/MeowKit-React-Library

npx pnpm@9.15.0 install
npx pnpm@9.15.0 --filter @meowkit/components... build
npx pnpm@9.15.0 fetch-firmware
npx pnpm@9.15.0 dev
```

`preinstall` runs `scripts/ensure-vendor.mjs` and exits with clone instructions if `vendor/MeowKit-React-Library` is missing.

## MeowKit UI packages

GitHub `path:` dependencies did not resolve the library's internal `workspace:*` links, so this repo vendors [MeowKit-React-Library](https://github.com/pve-homelab/MeowKit-React-Library) under `vendor/MeowKit-React-Library` and links packages via `pnpm-workspace.yaml` (`workspace:*` in `package.json`).

After clone or when UI packages change, rebuild the library:

```bash
npx pnpm@9.15.0 install
npx pnpm@9.15.0 --filter @meowkit/components... build
```

## Bundled firmware

Run once (or before packaging) to download the official factory image into `resources/firmware`:

```bash
npx pnpm@9.15.0 fetch-firmware
```

This fetches `meowkit-s3-v1.0.0-factory.bin` from the [official installer repo](https://github.com/mingolucky/meowkit-s3-installer), verifies SHA256, and writes `resources/firmware/v1.0.0/`. Dev (`pnpm dev`) and packaged builds both read that tree (`firmwareRoot()` → `resources/firmware` in dev, `process.resourcesPath/firmware` when packaged via electron-builder `extraResources`).

## Soft-entry download mode (reserved)

The Companion defines a reserved serial command for a **future** firmware release. Stock official firmware does not implement it.

| Item | Value |
|------|-------|
| Command | `MK+REBOOT_DL\n` (ASCII line with trailing newline) |
| Success ACK | `MK+OK REBOOT_DL` (exact line, within 1500 ms) |
| Stock firmware | `{ ok: false, reason: 'unsupported' }` — **expected** |

When soft-entry returns `unsupported`, the Flash view shows the guided **BOOT fallback** (power off → hold BOOT → power on → connect USB → pick `USB JTAG/serial debug unit`). No changes are made to [official firmware](https://github.com/mingolucky/meowkit-s3-firmware) in this milestone.

Constants live in `shared/protocol.ts`; `device.rebootToDownloadMode()` is exposed via preload IPC.

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Electron + Vite dev shell |
| `pnpm build` | Production build |
| `pnpm test` | Run Vitest unit suite |
| `pnpm typecheck` | TypeScript check (`src`, `electron`, `shared`) |
| `pnpm fetch-firmware` | Download bundled factory firmware into `resources/firmware` |

## Features (B→C)

| Area | Behavior |
|------|----------|
| **Device** | List USB ports, connect/disconnect CDC @ 115200, refresh |
| **Serial** | Live console, send lines, auto-reconnect status |
| **Flash** | Bundled v1.0.0 + custom `.bin`, optional erase (internal flash only; microSD untouched), progress/logs, BOOT fallback |
| **IDE** | MeowKit-themed scaffold (Monaco, mock build output) |

Serial and flash are **mutually exclusive** on one USB port (port coordinator disconnects serial before flash).

## Manual smoke checklist

Use a real MeowKit on hardware. Full checklist: [`docs/superpowers/plans/2026-09-13-companion-b-c-smoke.md`](docs/superpowers/plans/2026-09-13-companion-b-c-smoke.md).

**Serial (B)**

- [ ] App launches offline with MeowKit-themed shell
- [ ] Device/Serial lists CDC port; connect @ 115200
- [ ] Send a line; device echo or log appears in console
- [ ] Unplug USB → status shows disconnect/reconnecting; replug restores session

**Flash (C)**

- [ ] `fetch-firmware` populated; Flash panel shows bundled v1.0.0
- [ ] Start flash → soft-entry returns `unsupported` → BOOT guide appears (stock firmware)
- [ ] After BOOT confirm, select `USB JTAG/serial debug unit` (or closest match)
- [ ] Factory flash completes with progress/logs (airplane mode OK — no network required)
- [ ] Optional: erase + flash; confirm microSD files unchanged

## Testing

```bash
npx pnpm@9.15.0 test
npx pnpm@9.15.0 typecheck
```

## References

| Resource | Link |
|----------|------|
| B→C design spec | [`docs/superpowers/specs/2026-09-13-companion-b-c-design.md`](docs/superpowers/specs/2026-09-13-companion-b-c-design.md) |
| Implementation plan | [`docs/superpowers/plans/2026-09-13-companion-b-c.md`](docs/superpowers/plans/2026-09-13-companion-b-c.md) |
| MeowKit docs | [docs.meowkit.cc](https://docs.meowkit.cc/) |
| Docs source | [mingolucky/meowkit-s3-docs](https://github.com/mingolucky/meowkit-s3-docs) |
| Web installer | [mingolucky/meowkit-s3-installer](https://github.com/mingolucky/meowkit-s3-installer) · [Download page](https://meowkit.cc/pages/download) |
| Official firmware | [mingolucky/meowkit-s3-firmware](https://github.com/mingolucky/meowkit-s3-firmware) |
| MeowKit UI (vendored) | [pve-homelab/MeowKit-React-Library](https://github.com/pve-homelab/MeowKit-React-Library) |
