import { useEffect, useState } from 'react';
import type { PortMode } from '../../shared/ipc';
import type { MeowKitBridge } from '../meowkit';

export function subscribePortMode(
  app: MeowKitBridge['app'] | undefined,
  onMode: (mode: PortMode) => void,
): () => void {
  if (!app) {
    return () => undefined;
  }

  let active = true;
  void app.getPortMode().then((mode) => {
    if (active) {
      onMode(mode);
    }
  });
  const unsubscribe = app.onPortMode((mode) => {
    if (active) {
      onMode(mode);
    }
  });

  return () => {
    active = false;
    unsubscribe();
  };
}

export function usePortMode(): PortMode {
  const [mode, setMode] = useState<PortMode>('idle');

  useEffect(() => {
    const app = typeof window !== 'undefined' ? window.meowkit?.app : undefined;
    return subscribePortMode(app, setMode);
  }, []);

  return mode;
}
