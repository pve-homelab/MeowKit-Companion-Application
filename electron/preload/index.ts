import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('meowkit', {
  version: '0.1.0',
});
