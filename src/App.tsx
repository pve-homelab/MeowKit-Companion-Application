import AppLayout from '@meowkit/components/app-layout';
import Button from '@meowkit/components/button';
import Sidebar from '@meowkit/components/sidebar';
import SpaceBetween from '@meowkit/components/space-between';
import StatusBar from '@meowkit/components/status-bar';
import { useState } from 'react';
import ViewErrorBoundary from './components/ViewErrorBoundary';
import { usePortMode } from './hooks/usePortMode';
import { APP_NAV_ITEMS, type AppViewId } from './navigation';
import AppsView from './views/AppsView';
import DeviceView from './views/DeviceView';
import FlashView from './views/FlashView';
import IdeView from './views/IdeView';
import SerialView from './views/SerialView';
import SettingsView from './views/SettingsView';

function renderView(view: AppViewId, setView: (next: AppViewId) => void) {
  switch (view) {
    case 'device':
      return (
        <ViewErrorBoundary title="Device">
          <DeviceView
            onOpenSerial={() => setView('serial')}
            onOpenFlash={() => setView('flash')}
            onOpenApps={() => setView('apps')}
            onOpenIde={() => setView('ide')}
          />
        </ViewErrorBoundary>
      );
    case 'serial':
      return (
        <ViewErrorBoundary title="Serial">
          <SerialView />
        </ViewErrorBoundary>
      );
    case 'flash':
      return (
        <ViewErrorBoundary title="Flash">
          <FlashView />
        </ViewErrorBoundary>
      );
    case 'apps':
      return (
        <ViewErrorBoundary title="Apps">
          <AppsView />
        </ViewErrorBoundary>
      );
    case 'ide':
      return (
        <ViewErrorBoundary title="IDE">
          <IdeView />
        </ViewErrorBoundary>
      );
    case 'settings':
      return (
        <ViewErrorBoundary title="Settings">
          <SettingsView />
        </ViewErrorBoundary>
      );
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

export default function App() {
  const [view, setView] = useState<AppViewId>('device');
  const [navigationOpen, setNavigationOpen] = useState(true);
  const portMode = usePortMode();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppLayout
        navigationOpen={navigationOpen}
        onNavigationChange={setNavigationOpen}
        navigation={
          <Sidebar header="MeowKit">
            <SpaceBetween direction="vertical" size="xs">
              {APP_NAV_ITEMS.map((item) => (
                <Button
                  key={item.id}
                  variant={view === item.id ? 'primary' : 'ghost'}
                  aria-current={view === item.id ? 'page' : undefined}
                  style={{ width: '100%' }}
                  onClick={() => setView(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </SpaceBetween>
          </Sidebar>
        }
        content={
          <div
            style={{
              height: '100%',
              minHeight: 'calc(100vh - 120px)',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            {renderView(view, setView)}
          </div>
        }
        statusBar={
          <StatusBar left={`Port mode: ${portMode}`}>MeowKit Companion</StatusBar>
        }
      />
    </div>
  );
}
