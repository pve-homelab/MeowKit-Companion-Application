import type { MeowKitBridge } from '../meowkit';
import type {
  CatalogApp,
  CompanionSettings,
  FirmwareImage,
  FlashDone,
  FlashProgress,
  PortMode,
  SerialPortInfo,
  SerialStatus,
  SettingsPatch,
} from '../../shared/ipc';
import type { WorkspaceFileNode } from '../../shared/workspace';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../shared/settings';
import { getTemplate } from '../../shared/templates';
import { fileTree, mockFiles } from '../views/ideMockFiles';

function treeFromPaths(paths: string[]): WorkspaceFileNode[] {
  type Mutable = WorkspaceFileNode & { children?: Mutable[] };
  const root: Mutable[] = [];

  for (const filePath of paths.sort()) {
    const parts = filePath.split('/');
    let level = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      const id = parts.slice(0, i + 1).join('/');
      const isFile = i === parts.length - 1;
      let node = level.find((entry) => entry.name === part);
      if (!node) {
        node = {
          id,
          name: part,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
        };
        level.push(node);
      }
      if (!isFile) {
        node.children ??= [];
        level = node.children;
      }
    }
  }
  return root;
}

const MOCK_CATALOG: CatalogApp[] = [
  {
    id: 'retrotv',
    name: 'RetroTV',
    description: 'Browse and play IR TV codes from the SD card library.',
    version: '1.2.0',
    category: 'entertainment',
  },
  {
    id: 'ir-blaster',
    name: 'IR Blaster',
    description: 'Send custom infrared payloads from saved presets.',
    version: '0.9.1',
    category: 'utilities',
  },
  {
    id: 'gpio-lab',
    name: 'GPIO Lab',
    description: 'Probe expansion header pins and PWM helpers.',
    version: '1.0.0',
    category: 'developer',
  },
  {
    id: 'audio-pad',
    name: 'Audio Pad',
    description: 'Sample pad using onboard mic and speaker.',
    version: '1.1.0',
    category: 'creative',
  },
];

function createEmitter<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    emit(value: T) {
      for (const listener of [...listeners]) listener(value);
    },
    subscribe(cb: (value: T) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/** In-browser mock so Vite can preview UI without Electron/native serial. */
export function createMockMeowKitBridge(): MeowKitBridge {
  let portMode: PortMode = 'idle';
  let connectedPath: string | null = null;
  let serialStatus: SerialStatus = { state: 'disconnected' };
  let lineId = 1;
  const customs: FirmwareImage[] = [];

  const data = createEmitter<string>();
  const status = createEmitter<SerialStatus>();
  const progress = createEmitter<FlashProgress>();
  const log = createEmitter<string>();
  const done = createEmitter<FlashDone>();
  const mode = createEmitter<PortMode>();
  const buildLog = createEmitter<string>();
  const installedApps = new Set<string>();

  const setMode = (next: PortMode) => {
    portMode = next;
    mode.emit(next);
  };

  const setStatus = (next: SerialStatus) => {
    serialStatus = next;
    status.emit(next);
  };

  let mockProjectOpen = false;
  let mockSettings: CompanionSettings = structuredClone(DEFAULT_SETTINGS);
  const mockRecent: string[] = [];
  const mockFileContents = Object.fromEntries(
    Object.values(mockFiles).map((file) => [file.path, file.content]),
  );

  const mockPorts: SerialPortInfo[] = [
    {
      path: 'COM16',
      friendlyName: 'USB JTAG/serial debug unit (COM16)',
      vendorId: '303A',
      productId: '1001',
    },
    {
      path: 'COM3',
      friendlyName: 'USB Serial Device (COM3)',
      vendorId: '303A',
      productId: '4001',
    },
  ];

  return {
    serial: {
      async listPorts() {
        return mockPorts;
      },
      async connect(opts) {
        if (portMode === 'flashing') {
          throw new Error('Port busy: flashing');
        }
        connectedPath = opts.path;
        setMode('serial');
        setStatus({ state: 'connected', path: opts.path, baudRate: opts.baudRate });
        data.emit(`[mock] connected ${opts.path} @ ${opts.baudRate}\n`);
      },
      async disconnect() {
        connectedPath = null;
        setMode('idle');
        setStatus({ state: 'disconnected' });
      },
      async write(payload: string) {
        data.emit(`>>> ${payload}`);
        data.emit(`echo: ${payload.trim()}\n`);
      },
      async reset() {
        if (!connectedPath) {
          throw new Error('Not connected');
        }
        data.emit('[mock] DTR pulse — device reset\n');
      },
      async saveLog(content: string) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `serial-log-${Date.now()}.txt`;
        anchor.click();
        URL.revokeObjectURL(url);
        return true;
      },
      async getStatus() {
        return serialStatus;
      },
      onData: (cb) => data.subscribe(cb),
      onStatus: (cb) => status.subscribe(cb),
    },
    flash: {
      async getImages() {
        return [
          {
            id: 'bundled:v1.0.0',
            label: 'MeowKit S3 v1.0.0 (factory)',
            version: '1.0.0',
            path: 'mock://firmware/v1.0.0/meowkit-s3-v1.0.0-factory.bin',
            sha256: 'f4f44fe9edc9eb59d40fbe5a179d1470878a97ec1ece55fab955dab52693af9a',
            source: 'bundled' as const,
          },
          ...customs,
        ];
      },
      async pickCustomImage() {
        const image: FirmwareImage = {
          id: `custom:mock-${lineId++}.bin`,
          label: `custom-mock-${lineId}.bin`,
          path: `C:\\mock\\custom-${lineId}.bin`,
          source: 'custom',
        };
        customs.unshift(image);
        return image;
      },
      async start(opts) {
        setMode('flashing');
        log.emit(`Mock flash start erase=${opts.erase} image=${opts.imageId ?? opts.path ?? 'unknown'}`);
        for (const percent of [10, 40, 70, 100]) {
          await new Promise((r) => setTimeout(r, 200));
          progress.emit({ percent });
          log.emit(`Wrote ${percent}%`);
        }
        setMode('idle');
        done.emit({ ok: true });
      },
      async cancel() {
        setMode('idle');
        done.emit({ ok: false, error: 'aborted' });
      },
      onProgress: (cb) => progress.subscribe(cb),
      onLog: (cb) => log.subscribe(cb),
      onDone: (cb) => done.subscribe(cb),
    },
    device: {
      async rebootToDownloadMode() {
        if (!connectedPath) {
          return { ok: false as const, reason: 'not-connected' as const };
        }
        // Stock firmware behavior in mock preview
        return { ok: false as const, reason: 'unsupported' as const };
      },
      async getTelemetry() {
        if (!connectedPath) {
          return { ok: false as const, reason: 'not-connected' as const };
        }
        return {
          ok: true as const,
          telemetry: {
            firmware: '1.0.0',
            battery: 85,
            sdUsedMb: 120,
            sdTotalMb: 8192,
            wifi: true,
            bt: false,
          },
        };
      },
    },
    app: {
      async getPortMode() {
        return portMode;
      },
      onPortMode: (cb) => mode.subscribe(cb),
    },
    settings: {
      async get() {
        return structuredClone(mockSettings);
      },
      async set(patch: SettingsPatch) {
        mockSettings = normalizeSettings({
          serial: { ...mockSettings.serial, ...patch.serial },
          ide: { ...mockSettings.ide, ...patch.ide },
          theme: { ...mockSettings.theme, ...patch.theme },
        });
        return structuredClone(mockSettings);
      },
    },
    workspace: {
      async pickFolder() {
        mockProjectOpen = true;
        const path = 'C:\\mock\\meowkit-project';
        if (!mockRecent.includes(path)) {
          mockRecent.unshift(path);
        }
        return path;
      },
      async readTree() {
        if (!mockProjectOpen) {
          throw new Error('No workspace folder open');
        }
        const paths = Object.keys(mockFileContents);
        return paths.length > 0 ? treeFromPaths(paths) : (fileTree as WorkspaceFileNode[]);
      },
      async readFile(relativePath) {
        if (!mockProjectOpen) {
          throw new Error('No workspace folder open');
        }
        const content = mockFileContents[relativePath];
        if (content === undefined) {
          throw new Error(`Not a file: ${relativePath}`);
        }
        return content;
      },
      async writeFile(relativePath, content) {
        if (!mockProjectOpen) {
          throw new Error('No workspace folder open');
        }
        mockFileContents[relativePath] = content;
      },
      async getRecent() {
        return [...mockRecent];
      },
      async addRecent(path) {
        const next = [path, ...mockRecent.filter((entry) => entry !== path)].slice(0, 10);
        mockRecent.splice(0, mockRecent.length, ...next);
        mockSettings = normalizeSettings({
          ...mockSettings,
          ide: { ...mockSettings.ide, recentProjects: [...mockRecent] },
        });
        return [...mockRecent];
      },
      async createFromTemplate(templateId) {
        const template = getTemplate(templateId);
        if (!template) {
          throw new Error(`Unknown template: ${templateId}`);
        }
        mockProjectOpen = true;
        const path = `C:\\mock\\${templateId}`;
        for (const file of template.files) {
          mockFileContents[file.path] = file.content;
        }
        if (!mockRecent.includes(path)) {
          mockRecent.unshift(path);
        }
        mockSettings = normalizeSettings({
          ...mockSettings,
          ide: { ...mockSettings.ide, recentProjects: [...mockRecent] },
        });
        return path;
      },
    },
    apps: {
      async listCatalog() {
        return MOCK_CATALOG.map((app) => ({ ...app }));
      },
      async getInstalled() {
        return [...installedApps].sort();
      },
      async install(id) {
        if (!MOCK_CATALOG.some((app) => app.id === id)) {
          throw new Error(`Unknown app id: ${id}`);
        }
        installedApps.add(id);
      },
      async remove(id) {
        installedApps.delete(id);
      },
      async syncToDevice() {
        const stagedIds = [...installedApps].sort();
        if (stagedIds.length === 0) {
          return {
            ok: false as const,
            reason: 'nothing-staged' as const,
            message: 'Nothing to sync. Install (stage) apps first, then sync to the device.',
            stagedIds: [],
          };
        }
        return {
          ok: false as const,
          reason: 'msc-unavailable' as const,
          message:
            'Apps are staged on this PC only. Sync to the MeowKit SD card needs USB MSC (or an install protocol) from a future firmware update. Unstage with Remove if you change your mind.',
          stagedIds,
        };
      },
    },
    build: {
      async run(opts) {
        if (mockSettings.ide.toolchain === 'none') {
          buildLog.emit('Configure toolchain in Settings');
          return { ok: false };
        }
        const outputPath = `${opts.projectPath}\\build\\output.bin`;
        buildLog.emit('Compiling sketch...');
        buildLog.emit(`Using ${mockSettings.ide.toolchain} toolchain`);
        buildLog.emit('Sketch uses 1234 bytes (4%) of program storage space.');
        buildLog.emit(`Output: ${outputPath}`);
        return { ok: true, outputPath };
      },
      onLog: (cb) => buildLog.subscribe(cb),
    },
  };
}

export function installMockMeowKitBridge(): void {
  if (typeof window === 'undefined') return;
  if (window.meowkit) return;
  window.meowkit = createMockMeowKitBridge();
}
