import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from '../shared/settings';
import { SettingsStore } from '../electron/main/services/settings-store';

describe('normalizeSettings', () => {
  it('merges partial JSON with defaults', () => {
    expect(normalizeSettings({ serial: { defaultBaudRate: 9600 } })).toEqual({
      ...DEFAULT_SETTINGS,
      serial: { ...DEFAULT_SETTINGS.serial, defaultBaudRate: 9600 },
    });
  });

  it('clamps recent projects and rejects invalid toolchain', () => {
    const normalized = normalizeSettings({
      ide: {
        toolchain: 'invalid' as 'none',
        recentProjects: Array.from({ length: 12 }, (_, i) => `/p${i}`),
      },
    });
    expect(normalized.ide.toolchain).toBe('none');
    expect(normalized.ide.recentProjects).toHaveLength(10);
    expect(normalized.ide.recentProjects[0]).toBe('/p0');
  });
});

describe('SettingsStore', () => {
  it('returns defaults when settings file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mk-settings-'));
    const store = new SettingsStore(dir);
    await expect(store.load()).resolves.toEqual(DEFAULT_SETTINGS);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('loads persisted settings merged with defaults', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mk-settings-'));
    await writeFile(
      join(dir, 'settings.json'),
      JSON.stringify({ serial: { defaultBaudRate: 57600, autoReconnect: false } }),
      'utf8',
    );
    const store = new SettingsStore(dir);
    await expect(store.load()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      serial: { defaultBaudRate: 57600, autoReconnect: false },
    });
  });

  it('persists merged settings on set', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mk-settings-'));
    const store = new SettingsStore(dir);
    await store.load();
    await store.set({
      ide: { toolchain: 'arduino', toolchainPath: 'C:\\arduino-cli.exe' },
    });
    const onDisk = JSON.parse(await readFile(join(dir, 'settings.json'), 'utf8'));
    expect(onDisk.ide.toolchain).toBe('arduino');
    expect(onDisk.ide.toolchainPath).toBe('C:\\arduino-cli.exe');
    expect(onDisk.serial.defaultBaudRate).toBe(DEFAULT_SETTINGS.serial.defaultBaudRate);
    expect(store.get().ide.toolchain).toBe('arduino');
  });
});
