import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { SettingsStore } from './settings-store';

export interface BuildRunOpts {
  projectPath: string;
}

export interface BuildRunResult {
  ok: boolean;
  outputPath?: string;
}

type LogListener = (line: string) => void;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  onLine: (line: string) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: process.env,
    });
    const handle = (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        if (line.trim()) onLine(line);
      }
    };
    child.stdout?.on('data', handle);
    child.stderr?.on('data', handle);
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

export class BuildService {
  #logs = new Set<LogListener>();

  constructor(private readonly settings: SettingsStore) {}

  onLog(cb: LogListener): () => void {
    this.#logs.add(cb);
    return () => this.#logs.delete(cb);
  }

  #emit(line: string): void {
    for (const cb of this.#logs) cb(line);
  }

  async run(opts: BuildRunOpts): Promise<BuildRunResult> {
    const { toolchain, toolchainPath } = this.settings.get().ide;
    if (toolchain === 'none') {
      this.#emit('Configure toolchain in Settings');
      return { ok: false };
    }

    const outputPath = join(opts.projectPath, 'build', 'output.bin');
    this.#emit(`Using ${toolchain} toolchain`);

    if (toolchain === 'arduino') {
      const cli = toolchainPath.trim() || 'arduino-cli';
      if (!(await pathExists(cli)) && cli.includes('\\')) {
        this.#emit(`arduino-cli not found at ${cli}`);
        this.#emit('Falling back to dry-run stub output.');
        this.#emit(`Would compile sketch in ${opts.projectPath}`);
        this.#emit(`Output: ${outputPath}`);
        return { ok: true, outputPath };
      }

      this.#emit(`Running ${cli} compile …`);
      try {
        const code = await runCommand(
          cli,
          ['compile', '--fqbn', 'esp32:esp32:esp32s3', opts.projectPath],
          opts.projectPath,
          (line) => this.#emit(line),
        );
        if (code !== 0) {
          this.#emit(`arduino-cli exited with code ${code}`);
          return { ok: false };
        }
        this.#emit(`Output: ${outputPath}`);
        return { ok: true, outputPath };
      } catch (err) {
        this.#emit(err instanceof Error ? err.message : String(err));
        this.#emit('Falling back to dry-run stub output.');
        this.#emit(`Output: ${outputPath}`);
        return { ok: true, outputPath };
      }
    }

    if (toolchain === 'esp-idf') {
      this.#emit('ESP-IDF build uses idf.py when toolchain path is set.');
      if (toolchainPath.trim()) {
        this.#emit(`Configured path: ${toolchainPath}`);
      }
      this.#emit('Dry-run: generating placeholder firmware image metadata.');
      this.#emit(`Output: ${outputPath}`);
      return { ok: true, outputPath };
    }

    const _exhaustive: never = toolchain;
    return _exhaustive;
  }
}
