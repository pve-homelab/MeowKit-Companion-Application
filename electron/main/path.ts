import { app } from 'electron';
import { join } from 'node:path';

export function firmwareRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'firmware');
  return join(app.getAppPath(), 'resources', 'firmware');
}
