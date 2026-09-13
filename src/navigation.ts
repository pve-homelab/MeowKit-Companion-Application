export type AppViewId = 'device' | 'serial' | 'flash' | 'ide';

export interface AppNavItem {
  id: AppViewId;
  label: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { id: 'device', label: 'Device' },
  { id: 'serial', label: 'Serial' },
  { id: 'flash', label: 'Flash' },
  { id: 'ide', label: 'IDE' },
];
