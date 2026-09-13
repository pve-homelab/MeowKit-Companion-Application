import '@meowkit/global-styles';
import { MeowKitProvider } from '@meowkit/components/provider';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <MeowKitProvider mode="light" accent="default">
    <App />
  </MeowKitProvider>,
);
