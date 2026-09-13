import Alert from '@meowkit/components/alert';
import Box from '@meowkit/components/box';
import Button from '@meowkit/components/button';
import Container from '@meowkit/components/container';
import DeviceManagerPanel from '@meowkit/components/device-manager-panel';
import Header from '@meowkit/components/header';
import KeyValuePairs from '@meowkit/components/key-value-pairs';
import SpaceBetween from '@meowkit/components/space-between';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeviceTelemetry } from '../../shared/ipc';
import { useMeowKitBridge } from '../hooks/useMeowKitBridge';
import {
  INITIAL_DEVICE_MANAGER_STATE,
  createDeviceManagerController,
  type DeviceManagerState,
} from './deviceManager';
import { buildTelemetryCards } from './deviceTelemetry';

export interface DeviceViewProps {
  onOpenSerial?: () => void;
  onOpenFlash?: () => void;
  onOpenApps?: () => void;
  onOpenIde?: () => void;
}

type TelemetryUiStatus = 'idle' | 'loading' | 'unsupported' | 'error';

export default function DeviceView({
  onOpenSerial,
  onOpenFlash,
  onOpenApps,
  onOpenIde,
}: DeviceViewProps) {
  const { serial, device } = useMeowKitBridge();
  const [state, setState] = useState<DeviceManagerState>(INITIAL_DEVICE_MANAGER_STATE);
  const [telemetry, setTelemetry] = useState<DeviceTelemetry | undefined>();
  const [telemetryStatus, setTelemetryStatus] = useState<TelemetryUiStatus>('idle');
  const [telemetryError, setTelemetryError] = useState<string | undefined>();
  const controllerRef = useRef<ReturnType<typeof createDeviceManagerController> | null>(null);

  const isConnected = state.connectedPath !== undefined;

  const refreshTelemetry = useCallback(async () => {
    if (!isConnected) {
      setTelemetry(undefined);
      setTelemetryStatus('idle');
      setTelemetryError(undefined);
      return;
    }

    setTelemetryStatus('loading');
    setTelemetryError(undefined);
    try {
      const result = await device.getTelemetry();
      if (result.ok) {
        setTelemetry(result.telemetry);
        setTelemetryStatus('idle');
        return;
      }

      switch (result.reason) {
        case 'unsupported':
          setTelemetry(undefined);
          setTelemetryStatus('unsupported');
          return;
        case 'not-connected':
          setTelemetry(undefined);
          setTelemetryStatus('idle');
          return;
        case 'error':
          setTelemetry(undefined);
          setTelemetryStatus('error');
          setTelemetryError(result.message ?? 'Telemetry query failed');
          return;
        default: {
          const _exhaustive: never = result.reason;
          return _exhaustive;
        }
      }
    } catch (err) {
      setTelemetry(undefined);
      setTelemetryStatus('error');
      setTelemetryError(err instanceof Error ? err.message : String(err));
    }
  }, [device, isConnected]);

  useEffect(() => {
    const controller = createDeviceManagerController(serial, setState);
    controllerRef.current = controller;
    void controller.refresh();
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [serial]);

  useEffect(() => {
    if (isConnected) {
      void refreshTelemetry();
      return;
    }
    setTelemetry(undefined);
    setTelemetryStatus('idle');
    setTelemetryError(undefined);
  }, [isConnected, refreshTelemetry]);

  return (
    <Container header={<Header variant="h1">Device</Header>}>
      <SpaceBetween direction="vertical" size="m">
        <DeviceManagerPanel
          devices={state.devices}
          selectedId={state.selectedId}
          onSelect={(id) => controllerRef.current?.select(id)}
          onConnect={() => {
            void controllerRef.current?.connect();
          }}
          onDisconnect={() => {
            void controllerRef.current?.disconnect();
          }}
          onRefresh={() => {
            void controllerRef.current?.refresh();
          }}
          status={state.status}
          errorMessage={state.errorMessage}
        />
        {isConnected ? (
          <SpaceBetween direction="vertical" size="xs">
            <SpaceBetween direction="horizontal" size="xs">
              <Header variant="h2">Telemetry</Header>
              <Button
                variant="secondary"
                onClick={() => {
                  void refreshTelemetry();
                }}
                disabled={telemetryStatus === 'loading'}
              >
                {telemetryStatus === 'loading' ? 'Querying…' : 'Refresh telemetry'}
              </Button>
            </SpaceBetween>
            {telemetryStatus === 'loading' ? (
              <Alert type="info">Asking the device for MK+STATUS…</Alert>
            ) : null}
            {telemetryStatus === 'unsupported' ? (
              <Alert type="warning">
                No telemetry yet — stock firmware does not answer <code>MK+STATUS?</code>. Battery,
                SD, Wi‑Fi, and Bluetooth will show here after a firmware update that adds that
                command. Connection still works (Serial tab).
              </Alert>
            ) : null}
            {telemetryStatus === 'error' && telemetryError ? (
              <Alert type="error">{telemetryError}</Alert>
            ) : null}
            {telemetryStatus === 'idle' && telemetry ? (
              <Alert type="success">Live telemetry from the device.</Alert>
            ) : null}
            <KeyValuePairs items={buildTelemetryCards(telemetry)} columns={2} />
            {telemetryStatus === 'unsupported' || (!telemetry && telemetryStatus !== 'loading') ? (
              <Box color="muted" fontSize="sm">
                Placeholders (—) mean the Companion asked and got no status reply.
              </Box>
            ) : null}
          </SpaceBetween>
        ) : (
          <Alert type="info">
            Connect a MeowKit port above to query telemetry (battery, SD, radios). Requires firmware
            support for <code>MK+STATUS?</code>.
          </Alert>
        )}
        {onOpenSerial || onOpenFlash || onOpenApps || onOpenIde ? (
          <SpaceBetween direction="horizontal" size="xs">
            {onOpenSerial ? (
              <Button variant="secondary" onClick={onOpenSerial}>
                Open Serial
              </Button>
            ) : null}
            {onOpenFlash ? (
              <Button variant="secondary" onClick={onOpenFlash}>
                Flash
              </Button>
            ) : null}
            {onOpenApps ? (
              <Button variant="secondary" onClick={onOpenApps}>
                Apps
              </Button>
            ) : null}
            {onOpenIde ? (
              <Button variant="secondary" onClick={onOpenIde}>
                IDE
              </Button>
            ) : null}
          </SpaceBetween>
        ) : null}
      </SpaceBetween>
    </Container>
  );
}
