import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AppsCatalogService,
  loadCatalog,
} from '../electron/main/services/apps-catalog';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mk-apps-'));
  const catalogRoot = join(root, 'catalog');
  const stagingRoot = join(root, 'staging');
  await mkdir(catalogRoot, { recursive: true });
  await writeFile(
    join(catalogRoot, 'catalog.json'),
    JSON.stringify(
      {
        apps: [
          {
            id: 'retrotv',
            name: 'RetroTV',
            description: 'IR TV codes',
            version: '1.0.0',
            category: 'entertainment',
          },
          {
            id: 'gpio-lab',
            name: 'GPIO Lab',
            description: 'Pin helpers',
            version: '1.0.0',
            category: 'developer',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  return { catalogRoot, stagingRoot };
}

describe('loadCatalog', () => {
  it('loads bundled catalog entries', async () => {
    const { catalogRoot } = await fixture();
    const apps = await loadCatalog(catalogRoot);
    expect(apps).toHaveLength(2);
    expect(apps[0]?.id).toBe('retrotv');
  });
});

describe('AppsCatalogService', () => {
  it('starts with no installed apps', async () => {
    const { catalogRoot, stagingRoot } = await fixture();
    const service = new AppsCatalogService(catalogRoot, stagingRoot);
    await expect(service.getInstalled()).resolves.toEqual([]);
  });

  it('installs app metadata into staging and lists it as installed', async () => {
    const { catalogRoot, stagingRoot } = await fixture();
    const service = new AppsCatalogService(catalogRoot, stagingRoot);
    await service.install('retrotv');
    await expect(service.getInstalled()).resolves.toEqual(['retrotv']);
    const manifest = await readFile(join(stagingRoot, 'retrotv', 'manifest.json'), 'utf8');
    expect(JSON.parse(manifest)).toMatchObject({ id: 'retrotv', name: 'RetroTV' });
  });

  it('remove clears staging folder', async () => {
    const { catalogRoot, stagingRoot } = await fixture();
    const service = new AppsCatalogService(catalogRoot, stagingRoot);
    await service.install('gpio-lab');
    await service.remove('gpio-lab');
    await expect(service.getInstalled()).resolves.toEqual([]);
  });

  it('rejects unknown app ids', async () => {
    const { catalogRoot, stagingRoot } = await fixture();
    const service = new AppsCatalogService(catalogRoot, stagingRoot);
    await expect(service.install('missing')).rejects.toThrow(/unknown app/i);
  });

  it('syncToDevice reports nothing-staged or msc-unavailable', async () => {
    const { catalogRoot, stagingRoot } = await fixture();
    const service = new AppsCatalogService(catalogRoot, stagingRoot);
    await expect(service.syncToDevice()).resolves.toMatchObject({
      ok: false,
      reason: 'nothing-staged',
    });
    await service.install('retrotv');
    await expect(service.syncToDevice()).resolves.toMatchObject({
      ok: false,
      reason: 'msc-unavailable',
      stagedIds: ['retrotv'],
    });
  });
});
