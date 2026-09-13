import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  normalizeSettings,
  type CompanionSettings,
  type SettingsPatch,
} from '../../../shared/settings';

const SETTINGS_FILE = 'settings.json';

export class SettingsStore {
  #settings: CompanionSettings = structuredClone(DEFAULT_SETTINGS);
  readonly #filePath: string;

  constructor(userDataDir: string) {
    this.#filePath = join(userDataDir, SETTINGS_FILE);
  }

  get filePath(): string {
    return this.#filePath;
  }

  async load(): Promise<CompanionSettings> {
    try {
      const text = await fs.readFile(this.#filePath, 'utf8');
      this.#settings = normalizeSettings(JSON.parse(text));
    } catch {
      this.#settings = structuredClone(DEFAULT_SETTINGS);
    }
    return this.get();
  }

  get(): CompanionSettings {
    return structuredClone(this.#settings);
  }

  async set(patch: SettingsPatch): Promise<CompanionSettings> {
    this.#settings = normalizeSettings(mergeSettings(this.#settings, patch));
    await this.#persist();
    return this.get();
  }

  async #persist(): Promise<void> {
    await fs.mkdir(dirname(this.#filePath), { recursive: true });
    await fs.writeFile(this.#filePath, `${JSON.stringify(this.#settings, null, 2)}\n`, 'utf8');
  }
}

export interface RecentStore {
  read(): Promise<string[]>;
  write(paths: string[]): Promise<void>;
}

export function createSettingsRecentStore(settings: SettingsStore): RecentStore {
  return {
    async read() {
      return settings.get().ide.recentProjects;
    },
    async write(paths) {
      await settings.set({ ide: { recentProjects: paths } });
    },
  };
}
