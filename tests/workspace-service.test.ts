import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  WorkspaceService,
  createJsonRecentStore,
  isPathUnderRoot,
  readTree,
  resolvePathUnderRoot,
} from '../electron/main/services/workspace-service';

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), 'mk-ws-'));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
  await mkdir(join(root, '.git'));
  await writeFile(join(root, 'README.md'), '# root');
  await writeFile(join(root, 'src', 'main.py'), 'print("hi")');
  await writeFile(join(root, 'node_modules', 'pkg', 'index.js'), 'module.exports = {}');
  await writeFile(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  return root;
}

describe('workspace path safety', () => {
  it('accepts paths under the workspace root', async () => {
    const root = await fixtureRoot();
    expect(isPathUnderRoot(root, join(root, 'src', 'main.py'))).toBe(true);
    expect(resolvePathUnderRoot(root, 'src/main.py')).toBe(join(root, 'src', 'main.py'));
  });

  it('rejects paths that escape the workspace root', async () => {
    const root = await fixtureRoot();
    expect(isPathUnderRoot(root, join(root, '..', 'outside.txt'))).toBe(false);
    expect(() => resolvePathUnderRoot(root, '../outside.txt')).toThrow(/escapes workspace root/i);
  });
});

describe('readTree', () => {
  it('builds a tree up to max depth and skips node_modules/.git', async () => {
    const root = await fixtureRoot();
    const tree = await readTree(root, 4);

    expect(tree.map((node) => node.name).sort()).toEqual(['README.md', 'src']);
    const src = tree.find((node) => node.name === 'src');
    expect(src?.children?.map((node) => node.name)).toEqual(['main.py']);
    expect(tree.some((node) => node.name === 'node_modules')).toBe(false);
    expect(tree.some((node) => node.name === '.git')).toBe(false);
  });

  it('respects max depth', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mk-ws-depth-'));
    await mkdir(join(root, 'a', 'b', 'c', 'd'), { recursive: true });
    await writeFile(join(root, 'a', 'b', 'c', 'd', 'deep.txt'), 'deep');

    const tree = await readTree(root, 2);
    const a = tree.find((node) => node.name === 'a');
    const b = a?.children?.find((node) => node.name === 'b');
    const c = b?.children?.find((node) => node.name === 'c');
    expect(c?.type).toBe('folder');
    expect(c?.children).toEqual([]);
  });
});

describe('WorkspaceService', () => {
  it('tracks recent projects with a max of 10 entries', async () => {
    const storePath = join(await mkdtemp(join(tmpdir(), 'mk-ws-store-')), 'settings.json');
    const recentStore = createJsonRecentStore(storePath);
    const service = new WorkspaceService({
      recentStore,
      pickFolderDialog: vi.fn(async () => null),
    });

    for (let i = 0; i < 12; i += 1) {
      await service.addRecent(join('C:\\projects', `p${i}`));
    }

    const recent = await service.getRecent();
    expect(recent).toHaveLength(10);
    expect(recent[0]).toBe(join('C:\\projects', 'p11'));
    expect(recent[9]).toBe(join('C:\\projects', 'p2'));
  });

  it('reads and writes files within the open workspace', async () => {
    const root = await fixtureRoot();
    const service = new WorkspaceService({
      recentStore: {
        read: async () => [],
        write: async () => undefined,
      },
      pickFolderDialog: vi.fn(async () => root),
    });

    await service.pickFolder();
    await service.writeFile('src/main.py', 'print("updated")');
    await expect(service.readFile('src/main.py')).resolves.toBe('print("updated")');
    await expect(service.readFile('../README.md')).rejects.toThrow(/escapes workspace root/i);
  });
});
