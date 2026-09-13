export type ToolchainKind = 'none' | 'arduino' | 'esp-idf';

export interface CompanionSettings {
  serial: {
    defaultBaudRate: number;
    autoReconnect: boolean;
  };
  ide: {
    recentProjects: string[];
    toolchain: ToolchainKind;
    toolchainPath: string;
  };
  theme: {
    accent: 'lime';
  };
}

export const DEFAULT_SETTINGS: CompanionSettings = {
  serial: {
    defaultBaudRate: 115200,
    autoReconnect: true,
  },
  ide: {
    recentProjects: [],
    toolchain: 'none',
    toolchainPath: '',
  },
  theme: {
    accent: 'lime',
  },
};

export const MAX_RECENT_PROJECTS = 10;

export type SettingsPatch = {
  serial?: Partial<CompanionSettings['serial']>;
  ide?: Partial<CompanionSettings['ide']>;
  theme?: Partial<CompanionSettings['theme']>;
};

const TOOLCHAIN_KINDS = new Set<ToolchainKind>(['none', 'arduino', 'esp-idf']);

export function mergeSettings(base: CompanionSettings, patch: SettingsPatch): CompanionSettings {
  return {
    serial: { ...base.serial, ...patch.serial },
    ide: { ...base.ide, ...patch.ide },
    theme: { ...base.theme, ...patch.theme },
  };
}

export function normalizeSettings(raw: unknown): CompanionSettings {
  const patch = (typeof raw === 'object' && raw !== null ? raw : {}) as SettingsPatch;
  const merged = mergeSettings(DEFAULT_SETTINGS, patch);

  const baud = Number(merged.serial.defaultBaudRate);
  merged.serial.defaultBaudRate =
    Number.isFinite(baud) && baud > 0 ? baud : DEFAULT_SETTINGS.serial.defaultBaudRate;
  merged.serial.autoReconnect = Boolean(merged.serial.autoReconnect);

  if (!TOOLCHAIN_KINDS.has(merged.ide.toolchain)) {
    merged.ide.toolchain = DEFAULT_SETTINGS.ide.toolchain;
  }
  merged.ide.toolchainPath = String(merged.ide.toolchainPath ?? '');
  merged.ide.recentProjects = Array.isArray(merged.ide.recentProjects)
    ? merged.ide.recentProjects
        .filter((entry): entry is string => typeof entry === 'string')
        .slice(0, MAX_RECENT_PROJECTS)
    : [];

  if (merged.theme.accent !== 'lime') {
    merged.theme.accent = DEFAULT_SETTINGS.theme.accent;
  }

  return merged;
}
