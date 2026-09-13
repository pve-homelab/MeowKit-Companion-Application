/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { ensureMeowKitBridge } from '../src/bridge/ensureMeowKitBridge';
import { useMeowKitBridge } from '../src/hooks/useMeowKitBridge';
import type { MeowKitBridge } from '../src/meowkit';

function stubBridge(overrides: Partial<MeowKitBridge> = {}): MeowKitBridge {
  return {
    serial: {
      listPorts: async () => [],
      connect: async () => undefined,
      disconnect: async () => undefined,
      write: async () => undefined,
      reset: async () => undefined,
      saveLog: async () => true,
      onData: () => () => undefined,
      onStatus: () => () => undefined,
      getStatus: async () => ({ state: 'disconnected' }),
    },
    flash: {
      getImages: async () => [],
      pickCustomImage: async () => null,
      start: async () => undefined,
      cancel: async () => undefined,
      onProgress: () => () => undefined,
      onLog: () => () => undefined,
      onDone: () => () => undefined,
    },
    device: {
      rebootToDownloadMode: async () => ({ ok: true }),
      getTelemetry: async () => ({ ok: false, reason: 'unsupported' }),
    },
    app: { getPortMode: async () => 'idle', onPortMode: () => () => undefined },
    settings: {
      get: async () => DEFAULT_SETTINGS,
      set: async () => DEFAULT_SETTINGS,
    },
    workspace: {
      pickFolder: async () => null,
      readTree: async () => [],
      readFile: async () => '',
      writeFile: async () => undefined,
      getRecent: async () => [],
      addRecent: async () => [],
      createFromTemplate: async () => null,
    },
    apps: {
      listCatalog: async () => [],
      getInstalled: async () => [],
      install: async () => undefined,
      remove: async () => undefined,
      syncToDevice: async () => ({
        ok: false,
        reason: 'msc-unavailable',
        message: 'staged only',
        stagedIds: [],
      }),
    },
    build: {
      run: async () => ({ ok: false }),
      onLog: () => () => undefined,
    },
    ...overrides,
  };
}

describe('useMeowKitBridge / ensureMeowKitBridge', () => {
  afterEach(() => {
    // @ts-expect-error clear between tests
    delete window.meowkit;
  });

  it('returns window.meowkit when the full preload bridge is present', () => {
    const bridge = stubBridge();
    window.meowkit = bridge;
    expect(useMeowKitBridge()).toBe(bridge);
  });

  it('installs a mock bridge when preload is missing', () => {
    // @ts-expect-error — simulate a renderer without preload
    delete window.meowkit;
    const bridge = useMeowKitBridge();
    expect(bridge.settings).toBeDefined();
    expect(bridge.workspace).toBeDefined();
    expect(bridge.build).toBeDefined();
  });

  it('patches missing namespaces onto a partial preload bridge', async () => {
    const partial = stubBridge();
    // @ts-expect-error intentional partial
    delete partial.settings;
    // @ts-expect-error intentional partial
    delete partial.workspace;
    window.meowkit = partial as MeowKitBridge;

    const bridge = ensureMeowKitBridge();
    expect(bridge.settings).toBeDefined();
    expect(bridge.workspace).toBeDefined();
    const settings = await bridge.settings.get();
    expect(settings.serial.defaultBaudRate).toBe(115200);
  });
});
