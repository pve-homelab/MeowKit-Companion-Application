import { MeowKitProvider } from '@meowkit/components/provider';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ensureMeowKitBridge } from './bridge/ensureMeowKitBridge';
import '@meowkit/global-styles';

// Patch missing bridge namespaces (stale Electron preload / browser preview).
ensureMeowKitBridge();

createRoot(document.getElementById('root')!).render(
  // lime → primary buttons/actions use MeowKit site green (#BBE700 / #9DDE00)
  <MeowKitProvider mode="light" accent="lime">
    <App />
  </MeowKitProvider>,
);
