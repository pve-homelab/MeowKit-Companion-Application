# MeowKit Companion Application

Offline Electron companion for MeowKit devices: serial console, firmware flashing, and MeowKitIDE scaffold.

## Prerequisites

- Node.js 20+
- pnpm 9 (`npx pnpm@9.15.0` on Windows if Corepack is unavailable)

## MeowKit UI packages

GitHub `path:` dependencies did not resolve the library's internal `workspace:*` links, so this repo vendors [MeowKit-React-Library](https://github.com/pve-homelab/MeowKit-React-Library) under `vendor/MeowKit-React-Library` and links packages via `pnpm-workspace.yaml` (`workspace:*` in `package.json`).

After clone or when UI packages change, build the library:

```bash
npx pnpm@9.15.0 install
npx pnpm@9.15.0 --filter @meowkit/components... build
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Electron + Vite dev shell |
| `pnpm build` | Production build |
| `pnpm test` | Run Vitest |
| `pnpm typecheck` | TypeScript check (`src`, `electron`, `shared`) |

## Development

```bash
git clone https://github.com/pve-homelab/MeowKit-React-Library.git vendor/MeowKit-React-Library
npx pnpm@9.15.0 install
npx pnpm@9.15.0 --filter @meowkit/components... build
npx pnpm@9.15.0 dev
```
