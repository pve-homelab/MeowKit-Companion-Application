import { createHash } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../resources/firmware/v1.0.0');
const fileName = 'meowkit-s3-v1.0.0-factory.bin';
const url =
  'https://raw.githubusercontent.com/mingolucky/meowkit-s3-installer/main/firmware/v1.0.0/meowkit-s3-v1.0.0-factory.bin';
const expected =
  'f4f44fe9edc9eb59d40fbe5a179d1470878a97ec1ece55fab955dab52693af9a';

const outPath = join(outDir, fileName);
await fs.mkdir(outDir, { recursive: true });
const res = await fetch(url);
if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
await pipeline(res.body, createWriteStream(outPath));
const buf = await fs.readFile(outPath);
const hash = createHash('sha256').update(buf).digest('hex');
if (hash !== expected) {
  await fs.unlink(outPath);
  throw new Error(`checksum mismatch: ${hash}`);
}
console.log(`Fetched ${fileName} (${buf.length} bytes) OK`);
