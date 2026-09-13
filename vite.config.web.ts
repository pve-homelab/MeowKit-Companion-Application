import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Renderer-only preview — no Electron, mock window.meowkit. */
export default defineConfig({
  root: '.',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve('shared'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
