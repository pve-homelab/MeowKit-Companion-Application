import type { MeowKitBridge } from '../meowkit';

export function useMeowKitBridge(): MeowKitBridge {
  const bridge = typeof window !== 'undefined' ? window.meowkit : undefined;
  if (!bridge) {
    throw new Error('MeowKit bridge unavailable. Is the Electron preload script loaded?');
  }
  return bridge;
}
