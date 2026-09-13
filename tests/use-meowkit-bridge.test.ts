/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { useMeowKitBridge } from '../src/hooks/useMeowKitBridge';
import type { MeowKitBridge } from '../src/meowkit';

function stubBridge(): MeowKitBridge {
  return {
    serial: {
      listPorts: async () => [],
      connect: async () => undefined,
      disconnect: async () => undefined,
      write: async () => undefined,
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
    device: { rebootToDownloadMode: async () => ({ ok: true }) },
    app: { getPortMode: async () => 'idle', onPortMode: () => () => undefined },
  };
}

describe('useMeowKitBridge', () => {
  it('returns window.meowkit when the preload bridge is present', () => {
    const bridge = stubBridge();
    window.meowkit = bridge;
    expect(useMeowKitBridge()).toBe(bridge);
  });

  it('throws when the preload bridge is missing', () => {
    // @ts-expect-error — simulate a renderer without preload
    delete window.meowkit;
    expect(() => useMeowKitBridge()).toThrow(/meowkit/i);
  });
});
