import type { MeowKitBridge } from '../meowkit';
import { createMockMeowKitBridge } from '../mock/meowkitBridge';

type BridgeNamespace = keyof MeowKitBridge;

const REQUIRED_NAMESPACES: BridgeNamespace[] = [
  'serial',
  'flash',
  'device',
  'app',
  'settings',
  'workspace',
  'apps',
  'build',
];

function missingNamespaces(bridge: Partial<MeowKitBridge> | undefined): BridgeNamespace[] {
  if (!bridge) return [...REQUIRED_NAMESPACES];
  return REQUIRED_NAMESPACES.filter((key) => {
    const value = bridge[key];
    return value == null || typeof value !== 'object';
  });
}

function assignNamespace<K extends BridgeNamespace>(
  target: MeowKitBridge,
  key: K,
  value: MeowKitBridge[K],
): void {
  target[key] = value;
}

/** Ensure every MeowKitBridge namespace exists (patches stale Electron preloads). */
export function ensureMeowKitBridge(): MeowKitBridge {
  if (typeof window === 'undefined') {
    throw new Error('MeowKit bridge unavailable outside a browser/renderer.');
  }

  const existing = window.meowkit as Partial<MeowKitBridge> | undefined;
  const missing = missingNamespaces(existing);
  if (missing.length === 0) {
    return existing as MeowKitBridge;
  }

  const mock = createMockMeowKitBridge();
  if (!existing) {
    window.meowkit = mock;
    return mock;
  }

  const patched = { ...mock, ...existing } as MeowKitBridge;
  for (const key of missing) {
    assignNamespace(patched, key, mock[key]);
  }
  window.meowkit = patched;
  return patched;
}
