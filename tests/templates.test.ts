import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scaffoldTemplate } from '../electron/main/services/templates-service';
import { PROJECT_TEMPLATES } from '../shared/templates';

describe('project templates', () => {
  it('lists three starter templates', () => {
    expect(PROJECT_TEMPLATES.map((t) => t.id)).toEqual([
      'arduino-blink',
      'python-hello',
      'cpp-module',
    ]);
  });

  it('scaffolds arduino-blink files under the project root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mk-tpl-'));
    await scaffoldTemplate(root, 'arduino-blink');
    const sketch = await readFile(join(root, 'src', 'main.ino'), 'utf8');
    expect(sketch).toMatch(/Serial\.begin\(115200\)/);
  });
});
