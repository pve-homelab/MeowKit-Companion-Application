import Alert from '@meowkit/components/alert';
import Box from '@meowkit/components/box';
import Container from '@meowkit/components/container';
import FirmwareFlashingPanel from '@meowkit/components/firmware-flashing-panel';
import FormField from '@meowkit/components/form-field';
import Header from '@meowkit/components/header';
import Select from '@meowkit/components/select';
import SpaceBetween from '@meowkit/components/space-between';
import { useEffect, useRef, useState } from 'react';
import BootModeGuide from '../components/BootModeGuide';
import { useMeowKitBridge } from '../hooks/useMeowKitBridge';
import { portsToSelectOptions } from './serialConsole';
import {
  INITIAL_FLASH_SESSION_STATE,
  createFlashSessionController,
  type FlashSessionState,
} from './flashSession';

export default function FlashView() {
  const { serial, flash, device } = useMeowKitBridge();
  const [state, setState] = useState<FlashSessionState>(INITIAL_FLASH_SESSION_STATE);
  const controllerRef = useRef<ReturnType<typeof createFlashSessionController> | null>(null);

  useEffect(() => {
    const controller = createFlashSessionController({ serial, flash, device }, setState);
    controllerRef.current = controller;
    void controller.loadImages();
    void controller.connect();
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [serial, flash, device]);

  return (
    <Container header={<Header variant="h1">Flash</Header>}>
      <SpaceBetween direction="vertical" size="m">
        <FormField label="Firmware image">
          <Select
            options={state.images.map((image) => ({ value: image.id, label: image.label }))}
            value={state.selectedImageId}
            onChange={(id) => controllerRef.current?.selectImage(id)}
            placeholder="Select firmware image"
            aria-label="Firmware image"
            disabled={state.status === 'busy'}
          />
        </FormField>
        <FormField label="Flash port">
          <Select
            options={portsToSelectOptions(state.ports)}
            value={state.selectedPortPath}
            onChange={(path) => controllerRef.current?.selectPort(path)}
            placeholder="Select USB JTAG/serial debug unit"
            aria-label="Flash port"
            disabled={state.status === 'busy'}
          />
        </FormField>
        {state.showBootGuide ? (
          <BootModeGuide
            onConfirm={() => {
              void controllerRef.current?.confirmBoot();
            }}
          />
        ) : null}
        {state.status === 'success' && state.resultMessage ? (
          <Alert type="success">{state.resultMessage}</Alert>
        ) : null}
        <FirmwareFlashingPanel
          status={state.status}
          progress={state.progress}
          deviceName={state.deviceName}
          errorMessage={state.errorMessage}
          confirmErase={state.confirmErase}
          onConfirmEraseChange={(confirmed) => controllerRef.current?.setConfirmErase(confirmed)}
          onConnect={() => {
            void controllerRef.current?.connect();
          }}
          onFlash={() => {
            void controllerRef.current?.flash();
          }}
          onCancel={() => {
            void controllerRef.current?.cancel();
          }}
        />
        {state.logs.length > 0 ? (
          <Box as="pre" color="muted" fontSize="sm">
            {state.logs.join('\n')}
          </Box>
        ) : null}
      </SpaceBetween>
    </Container>
  );
}
