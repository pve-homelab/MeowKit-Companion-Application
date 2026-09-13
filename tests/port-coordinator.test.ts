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
