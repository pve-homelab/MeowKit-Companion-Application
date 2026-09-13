import Alert from '@meowkit/components/alert';
import AppMarketplaceGrid, { type MarketplaceApp } from '@meowkit/components/app-marketplace-grid';
import Button from '@meowkit/components/button';
import Container from '@meowkit/components/container';
import Header from '@meowkit/components/header';
import SpaceBetween from '@meowkit/components/space-between';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeowKitBridge } from '../hooks/useMeowKitBridge';

type AppsFilter = 'all' | 'staged' | 'available';

export default function AppsView() {
  const meowkit = useMeowKitBridge();
  const [items, setItems] = useState<MarketplaceApp[]>([]);
  const [stagedIds, setStagedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<AppsFilter>('all');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, staged] = await Promise.all([
        meowkit.apps.listCatalog(),
        meowkit.apps.getInstalled(),
      ]);
      const stagedSet = new Set(staged);
      setStagedIds(staged);
      setItems(
        catalog.map((app) => ({
          id: app.id,
          name: app.name,
          description: stagedSet.has(app.id)
            ? `${app.description} · Staged on this PC only (not on the device yet)`
            : `${app.description} (v${app.version} · ${app.category})`,
          // Grid badge says "Installed" — we use it to mean staged on PC.
          installed: stagedSet.has(app.id),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [meowkit.apps]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    switch (filter) {
      case 'staged':
        return items.filter((item) => item.installed);
      case 'available':
        return items.filter((item) => !item.installed);
      case 'all':
        return items;
      default: {
        const _exhaustive: never = filter;
        return _exhaustive;
      }
    }
  }, [filter, items]);

  const handleInstall = useCallback(
    async (id: string) => {
      setBusyId(id);
      setInfo(null);
      try {
        await meowkit.apps.install(id);
        setInfo(
          'App staged on this PC. It is not on the MeowKit yet — click “Sync to device” when you are ready.',
        );
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [meowkit.apps, refresh],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      setBusyId(id);
      setInfo(null);
      try {
        await meowkit.apps.remove(id);
        setInfo('Removed from PC staging.');
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [meowkit.apps, refresh],
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setInfo(null);
    try {
      const result = await meowkit.apps.syncToDevice();
      if (result.ok) {
        setInfo(`Synced to device: ${result.syncedIds.join(', ')}`);
        return;
      }
      switch (result.reason) {
        case 'nothing-staged':
        case 'msc-unavailable':
        case 'error':
          setInfo(result.message);
          return;
        default: {
          const _exhaustive: never = result.reason;
          return _exhaustive;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [meowkit.apps]);

  return (
    <Container
      header={
        <Header
          variant="h1"
          description="Stage apps on this PC, then sync them to the MeowKit when USB storage is available."
        >
          Apps
        </Header>
      }
    >
      <SpaceBetween direction="vertical" size="m">
        <Alert type="warning">
          <strong>Install ≠ on device.</strong> Install only stages the app on this computer
          ({`userData/apps-staging/{id}`}). Use <strong>Sync to device</strong> to copy staged apps
          onto the MeowKit SD card (needs a future firmware USB MSC mode).
        </Alert>
        {info ? <Alert type="info">{info}</Alert> : null}
        {error ? <Alert type="error">{error}</Alert> : null}
        <SpaceBetween direction="horizontal" size="s">
          <Button
            variant={filter === 'all' ? 'primary' : 'secondary'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'staged' ? 'primary' : 'secondary'}
            onClick={() => setFilter('staged')}
          >
            Staged on PC ({stagedIds.length})
          </Button>
          <Button
            variant={filter === 'available' ? 'primary' : 'secondary'}
            onClick={() => setFilter('available')}
          >
            Available
          </Button>
          <Button
            variant="primary"
            disabled={syncing || loading}
            onClick={() => void handleSync()}
          >
            {syncing ? 'Syncing…' : 'Sync to device'}
          </Button>
        </SpaceBetween>
        {loading ? (
          <p>Loading catalog…</p>
        ) : (
          <AppMarketplaceGrid
            apps={visible}
            onInstall={busyId ? undefined : handleInstall}
            onOpen={busyId ? undefined : handleRemove}
          />
        )}
        {stagedIds.length > 0 ? (
          <Alert type="info">
            Staged now: {stagedIds.join(', ')}. The grid badge may say “Installed” — that means
            staged on PC. Open removes from staging.
          </Alert>
        ) : null}
      </SpaceBetween>
    </Container>
  );
}
