import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS } from '../src/navigation';

describe('app navigation', () => {
  it('lists Device, Serial, Flash, Apps, IDE, and Settings in order', () => {
    expect(APP_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Device',
      'Serial',
      'Flash',
      'Apps',
      'IDE',
      'Settings',
    ]);
    expect(APP_NAV_ITEMS.map((item) => item.id)).toEqual([
      'device',
      'serial',
      'flash',
      'apps',
      'ide',
      'settings',
    ]);
  });
});
