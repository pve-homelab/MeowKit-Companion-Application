import { promises as fs } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { TemplateId } from '../../../shared/templates';
import type { WorkspaceFileNode } from '../../../shared/workspace';
import { scaffoldTemplate } from './templates-service';

export const MAX_TREE_DEPTH = 4;
export const MAX_RECENT_PROJECTS = 10;
const SKIP_DIRS = new Set(['node_modules', '.git']);

interface RecentStore {
  read(): Promise<string[]>;
  write(paths: string[]): Promise<void>;
}

interface WorkspaceServiceDeps {
  pickFolderDialog: () => Promise<string | null>;
  recentStore: RecentStore;
}

export function isPathUnderRoot(rootPath: string, candidatePath: string): boolean {
  const root = resolve(rootPath);
  const target = resolve(candidatePath);
  const rel = relative(root, target);
  if (rel === '') return true;
  return !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith('..\\');
}

export function resolvePathUnderRoot(rootPath: string, relativePath: string): string {
  const root = resolve(rootPath);
  const target = resolve(root, relativePath);
  if (!isPathUnderRoot(root, target)) {
    throw new Error(`Path escapes workspace root: ${relativePath}`);
  }
  return target;
}

function toRelativeId(rootPath: string, fullPath: string): string {
  return relative(rootPath, fullPath).split(sep).join('/');
}

async function readDirTree(
  rootPath: string,
  dirPath: string,
  depth: number,
  maxDepth: number,
): Promise<WorkspaceFileNode[]> {
  if (depth > maxDepth) return [];

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const sorted = entries
    .filter((entry) => !(entry.isDirectory() && SKIP_DIRS.has(entry.name)))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  const nodes: WorkspaceFileNode[] = [];
  for (const entry of sorted) {
    const fullPath = join(dirPath, entry.name);
    const id = toRelativeId(rootPath, fullPath);

    if (entry.isDirectory()) {
      const children =
        depth < maxDepth ? await readDirTree(rootPath, fullPath, depth + 1, maxDepth) : [];
      nodes.push({ id, name: entry.name, type: 'folder', children });
      continue;
    }

    if (entry.isFile()) {
      nodes.push({ id, name: entry.name, type: 'file' });
    }
  }

  return nodes;
}

export async function readTree(
  rootPath: string,
  maxDepth = MAX_TREE_DEPTH,
): Promise<WorkspaceFileNode[]> {
  const root = resolve(rootPath);
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) {
    throw new Error(`Workspace root is not a directory: ${rootPath}`);
  }
  return readDirTree(root, root, 0, maxDepth);
}

export function createJsonRecentStore(filePath: string): RecentStore {
  return {
    async read() {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw) as { ide?: { recentProjects?: string[] } };
        return Array.isArray(parsed.ide?.recentProjects) ? parsed.ide.recentProjects : [];
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
      }
    },
    async write(paths) {
      await fs.mkdir(resolve(filePath, '..'), { recursive: true });
      await fs.writeFile(
        filePath,
        JSON.stringify({ ide: { recentProjects: paths } }, null, 2),
        'utf8',
      );
    },
  };
}

export class WorkspaceService {
  #rootPath: string | null = null;

  constructor(private readonly deps: WorkspaceServiceDeps) {}

  getRoot(): string | null {
    return this.#rootPath;
  }

  setRoot(rootPath: string): void {
    this.#rootPath = resolve(rootPath);
  }

  async pickFolder(): Promise<string | null> {
    const picked = await this.deps.pickFolderDialog();
    if (!picked) return null;
    this.#rootPath = resolve(picked);
    await this.addRecent(this.#rootPath);
    return this.#rootPath;
  }

  async readTree(): Promise<WorkspaceFileNode[]> {
    if (!this.#rootPath) {
      throw new Error('No workspace folder open');
    }
    return readTree(this.#rootPath);
  }

  async readFile(relativePath: string): Promise<string> {
    if (!this.#rootPath) {
      throw new Error('No workspace folder open');
    }
    const filePath = resolvePathUnderRoot(this.#rootPath, relativePath);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${relativePath}`);
    }
    return fs.readFile(filePath, 'utf8');
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    if (!this.#rootPath) {
      throw new Error('No workspace folder open');
    }
    const filePath = resolvePathUnderRoot(this.#rootPath, relativePath);
    await fs.writeFile(filePath, content, 'utf8');
  }

  async getRecent(): Promise<string[]> {
    return this.deps.recentStore.read();
  }

  async addRecent(projectPath: string): Promise<string[]> {
    const normalized = resolve(projectPath);
    const current = await this.deps.recentStore.read();
    const next = [normalized, ...current.filter((p) => resolve(p) !== normalized)].slice(
      0,
      MAX_RECENT_PROJECTS,
    );
    await this.deps.recentStore.write(next);
    return next;
  }

  async createFromTemplate(templateId: TemplateId): Promise<string | null> {
    const root = await this.pickFolder();
    if (!root) return null;
    await scaffoldTemplate(root, templateId);
    return root;
  }
}
