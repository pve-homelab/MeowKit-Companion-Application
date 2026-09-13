import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BuildService } from '../electron/main/services/build-service';
import { SettingsStore } from '../electron/main/services/settings-store';

describe('BuildService', () => {
  it('emits configure message and returns ok:false when toolchain is none', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mk-build-'));
    const settings = new SettingsStore(dir);
    await settings.load();
    const build = new BuildService(settings);
    const lines: string[] = [];
    build.onLog((line) => lines.push(line));

    const result = await build.run({ projectPath: 'C:/project' });

    expect(result).toEqual({ ok: false });
    expect(lines).toEqual(['Configure toolchain in Settings']);
  });

  it('returns mock output path when toolchain is configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mk-build-'));
    const settings = new SettingsStore(dir);
    await settings.load();
    await settings.set({ ide: { toolchain: 'arduino', toolchainPath: 'C:/arduino' } });
    const build = new BuildService(settings);
    const lines: string[] = [];
    build.onLog((line) => lines.push(line));

    const result = await build.run({ projectPath: 'C:/project' });

    expect(result.ok).toBe(true);
    expect(result.outputPath).toMatch(/build[\\/]output\.bin$/);
    expect(lines.some((line) => line.includes('Using arduino toolchain'))).toBe(true);
  });
});
