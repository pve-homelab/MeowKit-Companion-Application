import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS } from '../src/navigation';

describe('app navigation', () => {
  it('lists Device, Serial, Flash, and IDE in order', () => {
    expect(APP_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Device',
      'Serial',
      'Flash',
      'IDE',
    ]);
    expect(APP_NAV_ITEMS.map((item) => item.id)).toEqual([
      'device',
      'serial',
      'flash',
      'ide',
    ]);
  });
});
