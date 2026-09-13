export type AppViewId = 'device' | 'serial' | 'flash' | 'apps' | 'ide' | 'settings';

export interface AppNavItem {
  id: AppViewId;
  label: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { id: 'device', label: 'Device' },
  { id: 'serial', label: 'Serial' },
  { id: 'flash', label: 'Flash' },
  { id: 'apps', label: 'Apps' },
  { id: 'ide', label: 'IDE' },
  { id: 'settings', label: 'Settings' },
];
