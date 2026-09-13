# MeowKit Companion B→C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an offline Electron Companion App with MeowKit UI, live USB serial console (B), then ESP32-S3 factory/custom firmware flashing with soft-entry stub + BOOT fallback (C).

**Architecture:** Electron main owns `serialport` + `esptool-js`, port exclusivity, firmware files, and a reserved soft-entry protocol. Preload exposes typed `window.meowkit`. React renderer uses `@meowkit/*` from the git MeowKit React Library for Device / Serial / Flash / IDE scaffold views.

**Tech Stack:** Electron + electron-vite + React 18 + TypeScript + pnpm, `@meowkit/components` + `@meowkit/global-styles` (git dependency), `serialport`, `esptool-js`, Vitest, Monaco peers for IDE scaffold.

## Global Constraints

- Consume UI from `https://github.com/pve-homelab/MeowKit-React-Library.git` (git/workspace dependency); build library packages before app typecheck/dev.
- Do **not** modify official `mingolucky/meowkit-s3-firmware`.
- Offline-first: serial + flash require no network at runtime.
- Default serial baud: `115200`.
- Flash target: ESP32-S3 factory `.bin` at offset `0x0` (match official installer manifest).
- Soft-entry command (reserved): ASCII line `MK+REBOOT_DL\n`; success ACK line must be exactly `MK+OK REBOOT_DL` within 1500ms; otherwise `{ ok: false, reason: 'unsupported' }`.
- Erase means internal flash/NVS only; never imply microSD wipe in copy.
- Prefer flash port friendly name containing `USB JTAG/serial debug unit`.
- Windows PowerShell: use `npx pnpm@9.15.0` if Corepack is unavailable.

---

## File structure (create)

```
package.json
pnpm-workspace.yaml          # optional if vendoring library as submodule; else single package + git deps
electron.vite.config.ts
tsconfig.json
tsconfig.node.json
vitest.config.ts
index.html
electron/
  main/
    index.ts
    ipc.ts
    path.ts
    services/
      port-coordinator.ts
      serial-service.ts
      flash-service.ts
      firmware-store.ts
      device-protocol.ts
  preload/
    index.ts
shared/
  ipc.ts
  protocol.ts
src/
  main.tsx
  App.tsx
  vite-env.d.ts
  meowkit.d.ts
  views/
    DeviceView.tsx
    SerialView.tsx
    FlashView.tsx
    IdeView.tsx
  hooks/
    useMeowKitBridge.ts
  components/
    BootModeGuide.tsx
resources/
  firmware/
    v1.0.0/
      SHA256SUMS.txt
      meowkit-s3-v1.0.0-factory.bin   # fetched by script; may be gitignored until fetched
scripts/
  fetch-firmware.mjs
tests/
  port-coordinator.test.ts
  device-protocol.test.ts
  firmware-store.test.ts
  flash-service.test.ts
  serial-service.test.ts
README.md
```

---

### Task 1: Scaffold Electron + Vite + Vitest

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts`, `index.html`, `electron/main/index.ts`, `electron/preload/index.ts`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `README.md`

**Interfaces:**
- Consumes: none
- Produces: runnable `pnpm dev` shell (empty React root), `pnpm test` harness

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "meowkit-companion-application",
  "version": "0.1.0",
  "private": true,
  "description": "MeowKit Companion App + MeowKitIDE (offline serial + flash)",
  "main": "./out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "fetch-firmware": "node scripts/fetch-firmware.mjs",
    "postinstall": "electron-builder install-app-deps || true"
  },
  "dependencies": {
    "@meowkit/components": "github:pve-homelab/MeowKit-React-Library#main&path:/packages/components",
    "@meowkit/global-styles": "github:pve-homelab/MeowKit-React-Library#main&path:/packages/global-styles",
    "@meowkit/design-tokens": "github:pve-homelab/MeowKit-React-Library#main&path:/packages/design-tokens",
    "@monaco-editor/react": "^4.7.0",
    "electron-updater": "^6.3.9",
    "esptool-js": "^0.5.7",
    "monaco-editor": "^0.56.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "serialport": "^13.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "electron": "^35.0.0",
    "electron-vite": "^3.0.0",
    "typescript": "^5.8.2",
    "vite": "^6.2.2",
    "vitest": "^3.0.0"
  }
}
```

> If GitHub `path:` deps fail to resolve built `dist`, clone the library as `vendor/MeowKit-React-Library`, add a pnpm workspace, depend on `workspace:*`, and run `pnpm --filter @meowkit/components... build` before app scripts. Prefer that fallback in README if install errors.

- [ ] **Step 2: Add electron-vite + tsconfigs + stub entry files**

`electron.vite.config.ts`:

```ts
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve('electron/main/index.ts') } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve('electron/preload/index.ts') } } },
  },
  renderer: {
    root: '.',
    build: { rollupOptions: { input: { index: resolve('index.html') } } },
    plugins: [react()],
    resolve: { alias: { '@shared': resolve('shared') } },
  },
});
```

`electron/main/index.ts` (minimal):

```ts
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);
```

`electron/preload/index.ts`:

```ts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('meowkit', {
  version: '0.1.0',
});
```

`src/App.tsx`:

```tsx
export default function App() {
  return <main style={{ padding: 24 }}>MeowKit Companion</main>;
}
```

`src/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MeowKit Companion</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@shared': resolve('shared') } },
});
```

- [ ] **Step 3: Install and verify scaffold**

Run: `npx pnpm@9.15.0 install`  
Then: `npx pnpm@9.15.0 test`  
Expected: Vitest runs with `No test files found` or 0 tests — not a crash.

Run: `npx pnpm@9.15.0 exec tsc -p tsconfig.json --noEmit` once tsconfig includes `src`, `electron`, `shared`.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml electron.vite.config.ts tsconfig.json tsconfig.node.json vitest.config.ts index.html electron src README.md
git commit -m "chore: scaffold Electron Vite Companion App"
```

---

### Task 2: Shared IPC types + soft-entry protocol constants

**Files:**
- Create: `shared/ipc.ts`, `shared/protocol.ts`, `src/meowkit.d.ts`
- Test: `tests/device-protocol.test.ts` (protocol constants imported; full protocol service in Task 4)

**Interfaces:**
- Consumes: none
- Produces: `IpcChannels`, `SerialPortInfo`, `FirmwareImage`, `PortMode`, `RebootDownloadResult`, `SOFT_ENTRY_COMMAND`, `SOFT_ENTRY_ACK`, `SOFT_ENTRY_TIMEOUT_MS`

- [ ] **Step 1: Write `shared/protocol.ts`**

```ts
/** Reserved Companion ↔ firmware soft-entry framing (stock firmware ignores). */
export const SOFT_ENTRY_COMMAND = 'MK+REBOOT_DL\n';
export const SOFT_ENTRY_ACK = 'MK+OK REBOOT_DL';
export const SOFT_ENTRY_TIMEOUT_MS = 1500;
```

- [ ] **Step 2: Write `shared/ipc.ts`**

```ts
export type PortMode = 'idle' | 'serial' | 'flashing';

export interface SerialPortInfo {
  path: string;
  friendlyName: string;
  vendorId?: string;
  productId?: string;
}

export type SerialStatus =
  | { state: 'connected'; path: string; baudRate: number }
  | { state: 'disconnected' }
  | { state: 'reconnecting'; path: string; attempt: number }
  | { state: 'error'; message: string };

export interface FirmwareImage {
  id: string;
  label: string;
  version?: string;
  path: string;
  sha256?: string;
  source: 'bundled' | 'custom';
}

export type RebootDownloadResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'not-connected' | 'error'; message?: string };

export type FlashProgress = { percent: number; bytesWritten?: number };
export type FlashDone = { ok: boolean; error?: string };

export const IpcChannels = {
  serialListPorts: 'serial:listPorts',
  serialConnect: 'serial:connect',
  serialDisconnect: 'serial:disconnect',
  serialWrite: 'serial:write',
  serialData: 'serial:data',
  serialStatus: 'serial:status',
  flashGetImages: 'flash:getImages',
  flashPickCustom: 'flash:pickCustom',
  flashStart: 'flash:start',
  flashCancel: 'flash:cancel',
  flashProgress: 'flash:progress',
  flashLog: 'flash:log',
  flashDone: 'flash:done',
  deviceRebootDownload: 'device:rebootToDownloadMode',
  appGetPortMode: 'app:getPortMode',
  appPortMode: 'app:portMode',
} as const;
```

- [ ] **Step 3: Write `src/meowkit.d.ts`**

```ts
import type {
  FirmwareImage,
  FlashDone,
  FlashProgress,
  PortMode,
  RebootDownloadResult,
  SerialPortInfo,
  SerialStatus,
} from '../shared/ipc';

export interface MeowKitBridge {
  serial: {
    listPorts(): Promise<SerialPortInfo[]>;
    connect(opts: { path: string; baudRate: number }): Promise<void>;
    disconnect(): Promise<void>;
    write(data: string): Promise<void>;
    onData(cb: (chunk: string) => void): () => void;
    onStatus(cb: (status: SerialStatus) => void): () => void;
  };
  flash: {
    getImages(): Promise<FirmwareImage[]>;
    pickCustomImage(): Promise<FirmwareImage | null>;
    start(opts: { imageId?: string; path?: string; erase: boolean }): Promise<void>;
    cancel(): Promise<void>;
    onProgress(cb: (p: FlashProgress) => void): () => void;
    onLog(cb: (line: string) => void): () => void;
    onDone(cb: (done: FlashDone) => void): () => void;
  };
  device: {
    rebootToDownloadMode(): Promise<RebootDownloadResult>;
  };
  app: {
    getPortMode(): Promise<PortMode>;
    onPortMode(cb: (mode: PortMode) => void): () => void;
  };
}

declare global {
  interface Window {
    meowkit: MeowKitBridge;
  }
}

export {};
```

- [ ] **Step 4: Commit**

```bash
git add shared src/meowkit.d.ts
git commit -m "feat: add shared IPC types and soft-entry protocol constants"
```

---

### Task 3: PortCoordinator (exclusivity)

**Files:**
- Create: `electron/main/services/port-coordinator.ts`
- Test: `tests/port-coordinator.test.ts`

**Interfaces:**
- Consumes: `PortMode` from `shared/ipc.ts`
- Produces: `PortCoordinator` with `getMode()`, `requestSerial()`, `requestFlashing()`, `releaseToIdle()`, `onModeChange(cb)`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { PortCoordinator } from '../electron/main/services/port-coordinator';

describe('PortCoordinator', () => {
  it('starts idle', () => {
    expect(new PortCoordinator().getMode()).toBe('idle');
  });

  it('allows serial from idle', () => {
    const c = new PortCoordinator();
    expect(c.requestSerial()).toBe(true);
    expect(c.getMode()).toBe('serial');
  });

  it('blocks serial while flashing', () => {
    const c = new PortCoordinator();
    expect(c.requestFlashing()).toBe(true);
    expect(c.requestSerial()).toBe(false);
    expect(c.getMode()).toBe('flashing');
  });

  it('preempts serial when flashing requested', () => {
    const c = new PortCoordinator();
    const onPreempt = vi.fn();
    c.requestSerial();
    expect(c.requestFlashing({ onPreemptSerial: onPreempt })).toBe(true);
    expect(onPreempt).toHaveBeenCalledOnce();
    expect(c.getMode()).toBe('flashing');
  });

  it('emits mode changes', () => {
    const c = new PortCoordinator();
    const modes: string[] = [];
    c.onModeChange((m) => modes.push(m));
    c.requestSerial();
    c.releaseToIdle();
    expect(modes).toEqual(['serial', 'idle']);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx pnpm@9.15.0 test -- tests/port-coordinator.test.ts`  
Expected: FAIL — module not found / `PortCoordinator` undefined.

- [ ] **Step 3: Implement `port-coordinator.ts`**

```ts
import type { PortMode } from '../../../shared/ipc';

type ModeListener = (mode: PortMode) => void;

export class PortCoordinator {
  #mode: PortMode = 'idle';
  #listeners = new Set<ModeListener>();

  getMode(): PortMode {
    return this.#mode;
  }

  onModeChange(cb: ModeListener): () => void {
    this.#listeners.add(cb);
    return () => this.#listeners.delete(cb);
  }

  requestSerial(): boolean {
    if (this.#mode === 'flashing') return false;
    this.#set('serial');
    return true;
  }

  requestFlashing(opts?: { onPreemptSerial?: () => void }): boolean {
    if (this.#mode === 'serial') opts?.onPreemptSerial?.();
    this.#set('flashing');
    return true;
  }

  releaseToIdle(): void {
    this.#set('idle');
  }

  #set(mode: PortMode): void {
    if (this.#mode === mode) return;
    this.#mode = mode;
    for (const cb of this.#listeners) cb(mode);
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx pnpm@9.15.0 test -- tests/port-coordinator.test.ts`  
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add electron/main/services/port-coordinator.ts tests/port-coordinator.test.ts
git commit -m "feat: add port mode coordinator for serial/flash exclusivity"
```

---

### Task 4: DeviceProtocol soft-entry

**Files:**
- Create: `electron/main/services/device-protocol.ts`
- Test: `tests/device-protocol.test.ts`

**Interfaces:**
- Consumes: `SOFT_ENTRY_*` from `shared/protocol.ts`; a `SerialTransport` `{ isConnected(): boolean; write(data: string): Promise<void>; readLine(timeoutMs: number): Promise<string | null> }`
- Produces: `rebootToDownloadMode(transport): Promise<RebootDownloadResult>`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { rebootToDownloadMode } from '../electron/main/services/device-protocol';
import { SOFT_ENTRY_ACK, SOFT_ENTRY_COMMAND } from '../shared/protocol';

describe('rebootToDownloadMode', () => {
  it('returns not-connected when transport disconnected', async () => {
    const result = await rebootToDownloadMode({
      isConnected: () => false,
      write: vi.fn(),
      readLine: vi.fn(),
    });
    expect(result).toEqual({ ok: false, reason: 'not-connected' });
  });

  it('returns unsupported when ACK never arrives (stock firmware)', async () => {
    const write = vi.fn(async () => undefined);
    const result = await rebootToDownloadMode({
      isConnected: () => true,
      write,
      readLine: async () => null,
    });
    expect(write).toHaveBeenCalledWith(SOFT_ENTRY_COMMAND);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('returns ok when ACK matches', async () => {
    const result = await rebootToDownloadMode({
      isConnected: () => true,
      write: vi.fn(async () => undefined),
      readLine: async () => SOFT_ENTRY_ACK,
    });
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx pnpm@9.15.0 test -- tests/device-protocol.test.ts`  
Expected: FAIL — not found.

- [ ] **Step 3: Implement**

```ts
import type { RebootDownloadResult } from '../../../shared/ipc';
import {
  SOFT_ENTRY_ACK,
  SOFT_ENTRY_COMMAND,
  SOFT_ENTRY_TIMEOUT_MS,
} from '../../../shared/protocol';

export interface SerialTransport {
  isConnected(): boolean;
  write(data: string): Promise<void>;
  readLine(timeoutMs: number): Promise<string | null>;
}

export async function rebootToDownloadMode(
  transport: SerialTransport,
): Promise<RebootDownloadResult> {
  if (!transport.isConnected()) {
    return { ok: false, reason: 'not-connected' };
  }
  try {
    await transport.write(SOFT_ENTRY_COMMAND);
    const line = await transport.readLine(SOFT_ENTRY_TIMEOUT_MS);
    if (line?.trim() === SOFT_ENTRY_ACK) return { ok: true };
    return { ok: false, reason: 'unsupported' };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx pnpm@9.15.0 test -- tests/device-protocol.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/main/services/device-protocol.ts tests/device-protocol.test.ts shared/protocol.ts
git commit -m "feat: add soft-entry rebootToDownloadMode protocol stub"
```

---

### Task 5: FirmwareStore + fetch script

**Files:**
- Create: `electron/main/services/firmware-store.ts`, `electron/main/path.ts`, `scripts/fetch-firmware.mjs`, `resources/firmware/v1.0.0/SHA256SUMS.txt`
- Test: `tests/firmware-store.test.ts`

**Interfaces:**
- Consumes: Node `fs`/`crypto`; firmware root path
- Produces: `FirmwareStore.list()`, `resolveImage({ imageId?, path? })`, `verifyBundled(image)`, `addCustom(path)`

Official checksum (from installer):

```
f4f44fe9edc9eb59d40fbe5a179d1470878a97ec1ece55fab955dab52693af9a  meowkit-s3-v1.0.0-factory.bin
```

- [ ] **Step 1: Write `resources/firmware/v1.0.0/SHA256SUMS.txt`** with the line above.

- [ ] **Step 2: Write `scripts/fetch-firmware.mjs`**

```js
import { createHash } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../resources/firmware/v1.0.0');
const fileName = 'meowkit-s3-v1.0.0-factory.bin';
const url =
  'https://raw.githubusercontent.com/mingolucky/meowkit-s3-installer/main/firmware/v1.0.0/meowkit-s3-v1.0.0-factory.bin';
const expected =
  'f4f44fe9edc9eb59d40fbe5a179d1470878a97ec1ece55fab955dab52693af9a';

const outPath = join(outDir, fileName);
await fs.mkdir(outDir, { recursive: true });
const res = await fetch(url);
if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
await pipeline(res.body, createWriteStream(outPath));
const buf = await fs.readFile(outPath);
const hash = createHash('sha256').update(buf).digest('hex');
if (hash !== expected) {
  await fs.unlink(outPath);
  throw new Error(`checksum mismatch: ${hash}`);
}
console.log(`Fetched ${fileName} (${buf.length} bytes) OK`);
```

- [ ] **Step 3: Write failing FirmwareStore tests** using a temp dir fixture with a tiny fake bin + SUMS file.

```ts
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FirmwareStore } from '../electron/main/services/firmware-store';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mk-fw-'));
  const dir = join(root, 'v1.0.0');
  await mkdir(dir);
  const bin = Buffer.from('fake-firmware');
  const sha = createHash('sha256').update(bin).digest('hex');
  await writeFile(join(dir, 'meowkit-s3-v1.0.0-factory.bin'), bin);
  await writeFile(join(dir, 'SHA256SUMS.txt'), `${sha}  meowkit-s3-v1.0.0-factory.bin\n`);
  return { root, sha };
}

describe('FirmwareStore', () => {
  it('lists bundled image when bin + sums present', async () => {
    const { root, sha } = await fixture();
    const store = new FirmwareStore(root);
    const images = await store.list();
    expect(images).toHaveLength(1);
    expect(images[0].source).toBe('bundled');
    expect(images[0].sha256).toBe(sha);
  });

  it('verifyBundled throws on mismatch', async () => {
    const { root } = await fixture();
    await writeFile(join(root, 'v1.0.0', 'meowkit-s3-v1.0.0-factory.bin'), Buffer.from('tampered'));
    const store = new FirmwareStore(root);
    const [image] = await store.list();
    await expect(store.verifyBundled(image)).rejects.toThrow(/checksum/i);
  });

  it('addCustom appends custom image without sha', async () => {
    const { root } = await fixture();
    const custom = join(root, 'custom.bin');
    await writeFile(custom, Buffer.from('custom'));
    const store = new FirmwareStore(root);
    const image = await store.addCustom(custom);
    expect(image.source).toBe('custom');
    const list = await store.list();
    expect(list.some((i) => i.id === image.id)).toBe(true);
  });
});
```

- [ ] **Step 4: Implement `FirmwareStore`**

```ts
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import type { FirmwareImage } from '../../../shared/ipc';

const BUNDLED_NAME = 'meowkit-s3-v1.0.0-factory.bin';

export class FirmwareStore {
  #customs: FirmwareImage[] = [];

  constructor(private readonly firmwareRoot: string) {}

  async list(): Promise<FirmwareImage[]> {
    const bundled = await this.#listBundled();
    return [...bundled, ...this.#customs];
  }

  async addCustom(path: string): Promise<FirmwareImage> {
    const image: FirmwareImage = {
      id: `custom:${path}`,
      label: basename(path),
      path,
      source: 'custom',
    };
    this.#customs = [image, ...this.#customs.filter((c) => c.path !== path)];
    return image;
  }

  async resolveImage(opts: { imageId?: string; path?: string }): Promise<FirmwareImage> {
    const images = await this.list();
    if (opts.imageId) {
      const found = images.find((i) => i.id === opts.imageId);
      if (!found) throw new Error(`Unknown image id: ${opts.imageId}`);
      return found;
    }
    if (opts.path) return this.addCustom(opts.path);
    throw new Error('imageId or path required');
  }

  async verifyBundled(image: FirmwareImage): Promise<void> {
    if (image.source !== 'bundled' || !image.sha256) return;
    const buf = await fs.readFile(image.path);
    const hash = createHash('sha256').update(buf).digest('hex');
    if (hash !== image.sha256) {
      throw new Error(`Bundled firmware checksum mismatch for ${image.label}`);
    }
  }

  async #listBundled(): Promise<FirmwareImage[]> {
    const dir = join(this.firmwareRoot, 'v1.0.0');
    const binPath = join(dir, BUNDLED_NAME);
    try {
      await fs.access(binPath);
    } catch {
      return [];
    }
    const sums = await fs.readFile(join(dir, 'SHA256SUMS.txt'), 'utf8');
    const match = sums
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.endsWith(BUNDLED_NAME));
    const sha256 = match?.split(/\s+/)[0];
    return [
      {
        id: 'bundled:v1.0.0',
        label: 'MeowKit S3 v1.0.0 (factory)',
        version: '1.0.0',
        path: binPath,
        sha256,
        source: 'bundled',
      },
    ];
  }
}
```

- [ ] **Step 5: Run tests + fetch firmware**

Run: `npx pnpm@9.15.0 test -- tests/firmware-store.test.ts` — PASS.  
Run: `npx pnpm@9.15.0 fetch-firmware` — downloads ~7MB bin and prints OK.

Add to `.gitignore` only if you choose not to commit the large bin; otherwise commit both SUMS + bin for true offline clones. Prefer committing the bin for offline-first CI/dev machines without network.

- [ ] **Step 6: Commit**

```bash
git add electron/main/services/firmware-store.ts electron/main/path.ts scripts/fetch-firmware.mjs resources/firmware tests/firmware-store.test.ts
git commit -m "feat: add offline firmware store and fetch script"
```

---

### Task 6: SerialService

**Files:**
- Create: `electron/main/services/serial-service.ts`
- Test: `tests/serial-service.test.ts`

**Interfaces:**
- Consumes: `PortCoordinator`; injectable `SerialPortLike` factory
- Produces: `listPorts`, `connect`, `disconnect`, `write`, `onData`, `onStatus`, `asTransport()` for DeviceProtocol, auto-reconnect while mode is `serial`

- [ ] **Step 1: Write tests with a mock port factory** covering connect → write → data event; reject connect when coordinator is flashing; reconnect scheduling on unexpected close when mode still `serial`.

Minimal mock:

```ts
class MockPort {
  handlers: Record<string, Function[]> = {};
  isOpen = false;
  async open() { this.isOpen = true; }
  async close() { this.isOpen = false; this.emit('close'); }
  write(buf: Buffer | string, cb: (err?: Error | null) => void) { cb(null); }
  on(ev: string, cb: Function) { (this.handlers[ev] ??= []).push(cb); }
  emit(ev: string, ...args: unknown[]) { for (const cb of this.handlers[ev] ?? []) cb(...args); }
}
```

- [ ] **Step 2: Implement `SerialService`**

Key behaviors:
- `listPorts()` uses `SerialPort.list()` mapped to `SerialPortInfo` (`friendlyName` = `port.friendlyName || port.path`).
- `connect` calls `coordinator.requestSerial()`; if false, throw `Port busy: flashing`.
- Default path open at given baud; pipe data as utf8 strings on `onData`.
- Line buffer for `asTransport().readLine(timeoutMs)`.
- On unexpected `close`, if `coordinator.getMode() === 'serial'`, emit `reconnecting` and retry open with exponential backoff (500ms, 1s, 2s, max 5s), stop when `disconnect()` or mode ≠ `serial`.

- [ ] **Step 3: Run tests — PASS**

- [ ] **Step 4: Commit**

```bash
git add electron/main/services/serial-service.ts tests/serial-service.test.ts
git commit -m "feat: add SerialService with reconnect and protocol transport"
```

---

### Task 7: FlashService (esptool-js)

**Files:**
- Create: `electron/main/services/flash-service.ts`
- Test: `tests/flash-service.test.ts`

**Interfaces:**
- Consumes: `PortCoordinator`, `FirmwareStore`, `rebootToDownloadMode`, serial transport
- Produces: `start({ imageId?, path?, erase, portPath })`, `cancel()`, progress/log/done emitters

- [ ] **Step 1: Write tests with mocked flasher**

```ts
it('preempts serial, verifies bundled image, emits progress then done', async () => { /* ... */ });
it('blocks start if checksum fails', async () => { /* ... */ });
it('cancel sets aborted and emits done ok:false', async () => { /* ... */ });
```

Inject `flashBinary: (args) => Promise<void>` rather than calling real esptool-js in unit tests.

- [ ] **Step 2: Implement real adapter** wrapping `esptool-js` for production:

```ts
// Production path sketch (exact esptool-js API may need minor adjustment to package version):
// 1. Open serialport for download-mode device
// 2. Create Transport / ESPLoader
// 3. If erase: eraseFlash()
// 4. writeFlash({ fileArray: [{ data: uint8, address: 0 }], flashSize: '16MB', ... })
// 5. report progress via callback
```

Flash flow inside `start`:
1. `coordinator.requestFlashing({ onPreemptSerial: () => serial.disconnect() })`
2. Resolve + `verifyBundled` image
3. Optionally attempt `rebootToDownloadMode(serial.asTransport())` — if `unsupported`, caller/UI must wait for user BOOT confirmation before calling `start` with `portPath` of JTAG port (split into `prepareSoftEntry()` vs `executeFlash()` if cleaner)
4. Prefer splitting API:

```ts
prepareSoftEntry(): Promise<RebootDownloadResult>
executeFlash(opts: { imageId?: string; path?: string; erase: boolean; portPath: string }): Promise<void>
```

UI calls prepare → shows BOOT guide on unsupported → user picks JTAG port → executeFlash.

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

```bash
git add electron/main/services/flash-service.ts tests/flash-service.test.ts
git commit -m "feat: add FlashService with offline ESP32-S3 factory writes"
```

---

### Task 8: Main IPC wiring + preload bridge

**Files:**
- Modify: `electron/main/index.ts`
- Create: `electron/main/ipc.ts`, update `electron/preload/index.ts`
- Create: `src/hooks/useMeowKitBridge.ts`

**Interfaces:**
- Consumes: all services
- Produces: full `window.meowkit` matching `src/meowkit.d.ts`

- [ ] **Step 1: Implement `electron/main/ipc.ts`** registering handlers for every `IpcChannels` key; forward events to the focused `BrowserWindow` via `webContents.send`.

- [ ] **Step 2: Implement preload** using `ipcRenderer.invoke` / `on` with unsubscribe wrappers:

```ts
onData(cb) {
  const listener = (_: unknown, chunk: string) => cb(chunk);
  ipcRenderer.on(IpcChannels.serialData, listener);
  return () => ipcRenderer.removeListener(IpcChannels.serialData, listener);
}
```

- [ ] **Step 3: Resolve firmware root** via `electron/main/path.ts`:

```ts
import { app } from 'electron';
import { join } from 'node:path';

export function firmwareRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'firmware');
  return join(app.getAppPath(), 'resources', 'firmware');
}
```

Ensure electron-builder / electron-vite copies `resources/firmware` into extras (document in README).

- [ ] **Step 4: Manual smoke (no device):** `pnpm dev` → DevTools → `await window.meowkit.serial.listPorts()` returns array.

- [ ] **Step 5: Commit**

```bash
git add electron/main electron/preload src/hooks/useMeowKitBridge.ts
git commit -m "feat: expose typed meowkit IPC bridge to renderer"
```

---

### Task 9: MeowKit shell + navigation views

**Files:**
- Modify: `src/main.tsx`, `src/App.tsx`
- Create: `src/views/DeviceView.tsx`, `SerialView.tsx`, `FlashView.tsx`, `IdeView.tsx`

**Interfaces:**
- Consumes: `window.meowkit`, MeowKit layout components
- Produces: navigable Device / Serial / Flash / IDE shell

- [ ] **Step 1: Bootstrap styles**

```tsx
import '@meowkit/global-styles';
import { MeowKitProvider } from '@meowkit/components/provider';
```

Wrap app in `MeowKitProvider mode="light" accent="default"`.

- [ ] **Step 2: `App.tsx` shell** using `AppLayout` + `Sidebar` nav items: Device, Serial, Flash, IDE. `StatusBar` shows `portMode` from `meowkit.app.onPortMode`.

- [ ] **Step 3: `IdeView.tsx`** scaffold from library example (mock files OK; Save/Build stubs write to a local build log panel). Install Monaco peers already in package.json.

- [ ] **Step 4: Visual check** — `pnpm dev` shows MeowKit chrome offline.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: add MeowKit AppLayout shell and view navigation"
```

---

### Task 10: Wire Serial + Device views (Milestone B done)

**Files:**
- Modify: `src/views/SerialView.tsx`, `src/views/DeviceView.tsx`

- [ ] **Step 1: SerialView** — map ports to a Select; connect @ 115200; pipe `onData` into `SerialConsoleView` lines (`id` = incrementing string; stream `stdout`/`system`); `onSend` → `meowkit.serial.write(line + '\n')`; show reconnecting via system lines.

- [ ] **Step 2: DeviceView** — `DeviceManagerPanel` devices derived from `listPorts()` (+ connected path as `connected`); actions: Connect → serial connect, Disconnect, Refresh, quick “Open Serial” / “Flash” navigation callbacks via props from App.

- [ ] **Step 3: Hardware smoke (manual):** connect MeowKit CDC, send a line, observe echo/logs @ 115200; unplug/replug sees reconnect attempts.

- [ ] **Step 4: Commit**

```bash
git add src/views/SerialView.tsx src/views/DeviceView.tsx
git commit -m "feat: wire live serial console and device manager"
```

---

### Task 11: Flash view + BOOT guide (Milestone C)

**Files:**
- Create: `src/components/BootModeGuide.tsx`
- Modify: `src/views/FlashView.tsx`

- [ ] **Step 1: `BootModeGuide.tsx`** — numbered steps matching official docs (power off, Dupont BOOT, power 1–2s, connect USB, select `USB JTAG/serial debug unit`); note erase does not affect microSD; button “Device is in download mode”.

- [ ] **Step 2: FlashView flow**
  1. Load images via `flash.getImages()`.
  2. On Flash: call `device.rebootToDownloadMode()`.
  3. If `unsupported` / `not-connected`: show `BootModeGuide`; after confirm, require port selection (prefer JTAG name match).
  4. Call `flash.start` / `executeFlash` with erase checkbox (map to `FirmwareFlashingPanel` `confirmErase`).
  5. Stream progress/logs into panel; on done show success or safe-retry copy.

`FirmwareFlashingPanelProps` mapping:
- `status`: idle/busy/success/error
- `progress`: percent
- `onConnect`: list/select port helper
- `onFlash`: start flow
- `onCancel`: `flash.cancel`
- `confirmErase` / `onConfirmEraseChange`

- [ ] **Step 3: Hardware smoke:** flash bundled v1.0.0 with BOOT fallback; confirm app works offline (airplane mode); confirm SD files unchanged after erase+flash.

- [ ] **Step 4: Commit**

```bash
git add src/components/BootModeGuide.tsx src/views/FlashView.tsx
git commit -m "feat: add offline firmware flashing with BOOT fallback"
```

---

### Task 12: README + smoke checklist

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/plans/2026-09-13-companion-b-c-smoke.md` (optional short checklist)

- [ ] **Step 1: Document**
  - Prerequisites (Windows/macOS/Linux, USB data cable)
  - `pnpm install`, library build fallback, `pnpm fetch-firmware`, `pnpm dev`
  - Soft-entry reserved command (`MK+REBOOT_DL`) and that stock firmware returns unsupported
  - Manual smoke checklist for serial + flash
  - Link design spec + official docs

- [ ] **Step 2: Run full unit suite**

Run: `npx pnpm@9.15.0 test`  
Expected: all unit tests PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md docs
git commit -m "docs: add Companion B→C setup and smoke checklist"
```

---

## Spec coverage self-review

| Spec requirement | Task |
| --- | --- |
| Electron main + preload + React | 1, 8, 9 |
| Git MeowKit UI dependency | 1, 9 |
| Serial list/connect/write/reconnect @ 115200 | 6, 10 |
| Offline factory bin @ 0x0 + checksum | 5, 7, 11 |
| Custom `.bin` flash | 5, 7, 11 |
| Soft-entry stub + BOOT fallback | 2, 4, 7, 11 |
| Port exclusivity | 3, 6, 7 |
| No official firmware changes | Global + Task 4 |
| Device manager + IDE scaffold | 9, 10 |
| Error copy (JTAG hint, SD-safe erase) | 11, 12 |
| Unit tests for coordinator/protocol/store | 3, 4, 5 |

**Placeholder scan:** Soft-entry bytes fixed as `MK+REBOOT_DL` / `MK+OK REBOOT_DL`. esptool-js call sites noted as version-sensitive — Task 7 requires verifying against installed package typings during implementation (not left as TBD in behavior).

**Type consistency:** `PortMode`, `FirmwareImage`, `RebootDownloadResult`, and `IpcChannels` defined once in `shared/` and reused by main, preload, and `meowkit.d.ts`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-13-companion-b-c.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration  

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints  

Which approach?
