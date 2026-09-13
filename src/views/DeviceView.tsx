import Button from '@meowkit/components/button';
import Container from '@meowkit/components/container';
import DeviceManagerPanel from '@meowkit/components/device-manager-panel';
import Header from '@meowkit/components/header';
import SpaceBetween from '@meowkit/components/space-between';
import { useEffect, useRef, useState } from 'react';
import { useMeowKitBridge } from '../hooks/useMeowKitBridge';
import {
  INITIAL_DEVICE_MANAGER_STATE,
  createDeviceManagerController,
  type DeviceManagerState,
} from './deviceManager';

export interface DeviceViewProps {
  onOpenSerial?: () => void;
  onOpenFlash?: () => void;
}

export default function DeviceView({ onOpenSerial, onOpenFlash }: DeviceViewProps) {
  const { serial } = useMeowKitBridge();
  const [state, setState] = useState<DeviceManagerState>(INITIAL_DEVICE_MANAGER_STATE);
  const controllerRef = useRef<ReturnType<typeof createDeviceManagerController> | null>(null);

  useEffect(() => {
    const controller = createDeviceManagerController(serial, setState);
    controllerRef.current = controller;
    void controller.refresh();
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [serial]);

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
        {onOpenSerial || onOpenFlash ? (
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
          </SpaceBetween>
        ) : null}
      </SpaceBetween>
    </Container>
  );
}
