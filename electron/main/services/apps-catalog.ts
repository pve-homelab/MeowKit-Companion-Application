import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { AppsCatalogFile, CatalogApp } from '../../../shared/apps';

const CATALOG_FILE = 'catalog.json';
const MANIFEST_FILE = 'manifest.json';

export async function loadCatalog(catalogRoot: string): Promise<CatalogApp[]> {
  const raw = await fs.readFile(join(catalogRoot, CATALOG_FILE), 'utf8');
  const parsed = JSON.parse(raw) as AppsCatalogFile;
  if (!Array.isArray(parsed.apps)) {
    throw new Error('Invalid apps catalog: missing apps array');
  }
  return parsed.apps.filter(
    (app): app is CatalogApp =>
      typeof app?.id === 'string' &&
      typeof app?.name === 'string' &&
      typeof app?.description === 'string' &&
      typeof app?.version === 'string' &&
      typeof app?.category === 'string',
  );
}

export class AppsCatalogService {
  constructor(
    private readonly catalogRoot: string,
    private readonly stagingRoot: string,
  ) {}

  async listCatalog(): Promise<CatalogApp[]> {
    return loadCatalog(this.catalogRoot);
  }

  async getInstalled(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.stagingRoot, { withFileTypes: true });
      const installed: string[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          await fs.access(join(this.stagingRoot, entry.name, MANIFEST_FILE));
          installed.push(entry.name);
        } catch {
          // Ignore incomplete staging folders.
        }
      }
      return installed.sort();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async install(id: string): Promise<void> {
    const app = (await this.listCatalog()).find((entry) => entry.id === id);
    if (!app) {
      throw new Error(`Unknown app id: ${id}`);
    }
    const targetDir = join(this.stagingRoot, id);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(join(targetDir, MANIFEST_FILE), `${JSON.stringify(app, null, 2)}\n`, 'utf8');
  }

  async remove(id: string): Promise<void> {
    await fs.rm(join(this.stagingRoot, id), { recursive: true, force: true });
  }

  /**
   * Copy staged apps to the device (USB MSC / SD). Not available until firmware
   * exposes mass storage; returns a structured failure so the UI can guide the user.
   */
  async syncToDevice(): Promise<
    | { ok: true; syncedIds: string[] }
    | {
        ok: false;
        reason: 'msc-unavailable' | 'nothing-staged' | 'error';
        message: string;
        stagedIds: string[];
      }
  > {
    const stagedIds = await this.getInstalled();
    if (stagedIds.length === 0) {
      return {
        ok: false,
        reason: 'nothing-staged',
        message: 'Nothing to sync. Install (stage) apps first, then sync to the device.',
        stagedIds: [],
      };
    }
    return {
      ok: false,
      reason: 'msc-unavailable',
      message:
        'Apps are staged on this PC only. Sync to the MeowKit SD card needs USB MSC (or an install protocol) from a future firmware update. Unstage with Remove if you change your mind.',
      stagedIds,
    };
  }
}
