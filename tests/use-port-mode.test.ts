/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { subscribePortMode } from '../src/hooks/usePortMode';
import type { PortMode } from '../shared/ipc';

describe('subscribePortMode', () => {
  it('applies the current mode then listens for updates', async () => {
    const modes: PortMode[] = [];
    let listener: ((mode: PortMode) => void) | undefined;

    const unsubscribe = subscribePortMode(
      {
        getPortMode: async () => 'serial',
        onPortMode: (cb) => {
          listener = cb;
          return () => {
            listener = undefined;
          };
        },
      },
      (mode) => {
        modes.push(mode);
      },
    );

    await Promise.resolve();
    expect(modes).toEqual(['serial']);
    listener?.('flashing');
    expect(modes).toEqual(['serial', 'flashing']);
    unsubscribe();
    expect(listener).toBeUndefined();
  });

  it('returns a no-op unsubscribe when the app bridge is missing', () => {
    expect(subscribePortMode(undefined, () => undefined)).toBeTypeOf('function');
  });
});
