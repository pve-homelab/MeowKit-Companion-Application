import AppLayout from '@meowkit/components/app-layout';
import Button from '@meowkit/components/button';
import Sidebar from '@meowkit/components/sidebar';
import SpaceBetween from '@meowkit/components/space-between';
import StatusBar from '@meowkit/components/status-bar';
import { useState } from 'react';
import { usePortMode } from './hooks/usePortMode';
import { APP_NAV_ITEMS, type AppViewId } from './navigation';
import DeviceView from './views/DeviceView';
import FlashView from './views/FlashView';
import IdeView from './views/IdeView';
import SerialView from './views/SerialView';

function renderView(view: AppViewId, setView: (next: AppViewId) => void) {
  switch (view) {
    case 'device':
      return (
        <DeviceView
          onOpenSerial={() => setView('serial')}
          onOpenFlash={() => setView('flash')}
        />
      );
    case 'serial':
      return <SerialView />;
    case 'flash':
      return <FlashView />;
    case 'ide':
      return <IdeView />;
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
    <div style={{ height: '100vh' }}>
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
        content={renderView(view, setView)}
        statusBar={
          <StatusBar left={`Port mode: ${portMode}`}>MeowKit Companion</StatusBar>
        }
      />
    </div>
  );
}
