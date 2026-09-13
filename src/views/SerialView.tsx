import Container from '@meowkit/components/container';
import Header from '@meowkit/components/header';
import Select from '@meowkit/components/select';
import SerialConsoleView from '@meowkit/components/serial-console-view';
import SpaceBetween from '@meowkit/components/space-between';
import { useEffect, useRef, useState } from 'react';
import { useMeowKitBridge } from '../hooks/useMeowKitBridge';
import {
  INITIAL_SERIAL_CONSOLE_STATE,
  createSerialConsoleController,
  portsToSelectOptions,
  type SerialConsoleState,
} from './serialConsole';

export default function SerialView() {
  const { serial } = useMeowKitBridge();
  const [state, setState] = useState<SerialConsoleState>(INITIAL_SERIAL_CONSOLE_STATE);
  const controllerRef = useRef<ReturnType<typeof createSerialConsoleController> | null>(null);

  useEffect(() => {
    const controller = createSerialConsoleController(serial, setState);
    controllerRef.current = controller;
    void controller.refresh();
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [serial]);

  return (
    <Container header={<Header variant="h1">Serial</Header>}>
      <SpaceBetween direction="vertical" size="m">
        <Select
          options={portsToSelectOptions(state.ports)}
          value={state.selectedPath}
          onChange={(path) => {
            void controllerRef.current?.connect(path);
          }}
          placeholder="Select serial port"
          aria-label="Serial port"
        />
        <SerialConsoleView
          lines={state.lines}
          onSend={(line) => {
            void controllerRef.current?.send(line);
          }}
          onClear={() => controllerRef.current?.clear()}
          connected={state.connected}
        />
      </SpaceBetween>
    </Container>
  );
}
