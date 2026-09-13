import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import type { FirmwareImage } from '../../../shared/ipc';

const BUNDLED_NAME = 'meowkit-s3-v1.0.0-factory.bin';

export class FirmwareStore {
  #customs: FirmwareImage[] = [];

  constructor(private readonly firmwareRoot: string) {}

  async list(): Promise<FirmwareImage[]> {
    const bundled = await this.#listBundled();
    return [...bundled, ...this.#customs];
  }

  async addCustom(path: string): Promise<FirmwareImage> {
    const image: FirmwareImage = {
      id: `custom:${path}`,
      label: basename(path),
      path,
      source: 'custom',
    };
    this.#customs = [image, ...this.#customs.filter((c) => c.path !== path)];
    return image;
  }

  async resolveImage(opts: { imageId?: string; path?: string }): Promise<FirmwareImage> {
    const images = await this.list();
    if (opts.imageId) {
      const found = images.find((i) => i.id === opts.imageId);
      if (!found) throw new Error(`Unknown image id: ${opts.imageId}`);
      return found;
    }
    if (opts.path) return this.addCustom(opts.path);
    throw new Error('imageId or path required');
  }

  async verifyBundled(image: FirmwareImage): Promise<void> {
    if (image.source !== 'bundled' || !image.sha256) return;
    const buf = await fs.readFile(image.path);
    const hash = createHash('sha256').update(buf).digest('hex');
    if (hash !== image.sha256) {
      throw new Error(`Bundled firmware checksum mismatch for ${image.label}`);
    }
  }

  async #listBundled(): Promise<FirmwareImage[]> {
    const dir = join(this.firmwareRoot, 'v1.0.0');
    const binPath = join(dir, BUNDLED_NAME);
    try {
      await fs.access(binPath);
    } catch {
      return [];
    }
    const sums = await fs.readFile(join(dir, 'SHA256SUMS.txt'), 'utf8');
    const match = sums
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.endsWith(BUNDLED_NAME));
    const sha256 = match?.split(/\s+/)[0];
    return [
      {
        id: 'bundled:v1.0.0',
        label: 'MeowKit S3 v1.0.0 (factory)',
        version: '1.0.0',
        path: binPath,
        sha256,
        source: 'bundled',
      },
    ];
  }
}
