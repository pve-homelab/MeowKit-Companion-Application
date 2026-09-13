import { app } from 'electron';
import { join } from 'node:path';

export function firmwareRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'firmware');
  return join(app.getAppPath(), 'resources', 'firmware');
}

export function appsCatalogRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'apps');
  return join(app.getAppPath(), 'resources', 'apps');
}

export function appsStagingRoot(userDataDir: string): string {
  return join(userDataDir, 'apps-staging');
}
