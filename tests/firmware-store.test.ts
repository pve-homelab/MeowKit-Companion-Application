import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FirmwareStore } from '../electron/main/services/firmware-store';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mk-fw-'));
  const dir = join(root, 'v1.0.0');
  await mkdir(dir);
  const bin = Buffer.from('fake-firmware');
  const sha = createHash('sha256').update(bin).digest('hex');
  await writeFile(join(dir, 'meowkit-s3-v1.0.0-factory.bin'), bin);
  await writeFile(join(dir, 'SHA256SUMS.txt'), `${sha}  meowkit-s3-v1.0.0-factory.bin\n`);
  return { root, sha };
}

describe('FirmwareStore', () => {
  it('lists bundled image when bin + sums present', async () => {
    const { root, sha } = await fixture();
    const store = new FirmwareStore(root);
    const images = await store.list();
    expect(images).toHaveLength(1);
    expect(images[0].source).toBe('bundled');
    expect(images[0].sha256).toBe(sha);
  });

  it('verifyBundled throws on mismatch', async () => {
    const { root } = await fixture();
    await writeFile(join(root, 'v1.0.0', 'meowkit-s3-v1.0.0-factory.bin'), Buffer.from('tampered'));
    const store = new FirmwareStore(root);
    const [image] = await store.list();
    await expect(store.verifyBundled(image)).rejects.toThrow(/checksum/i);
  });

  it('addCustom appends custom image without sha', async () => {
    const { root } = await fixture();
    const custom = join(root, 'custom.bin');
    await writeFile(custom, Buffer.from('custom'));
    const store = new FirmwareStore(root);
    const image = await store.addCustom(custom);
    expect(image.source).toBe('custom');
    const list = await store.list();
    expect(list.some((i) => i.id === image.id)).toBe(true);
  });
});
