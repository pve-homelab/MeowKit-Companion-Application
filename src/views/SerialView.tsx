import Box from '@meowkit/components/box';
import Button from '@meowkit/components/button';
import Container from '@meowkit/components/container';
import Header from '@meowkit/components/header';
import Select from '@meowkit/components/select';
import SerialConsoleView from '@meowkit/components/serial-console-view';
import SpaceBetween from '@meowkit/components/space-between';
import { useEffect, useRef, useState } from 'react';
import { useMeowKitBridge } from '../hooks/useMeowKitBridge';
import {
  INITIAL_SERIAL_CONSOLE_STATE,
  baudRatesToSelectOptions,
  createSerialConsoleController,
  portsToSelectOptions,
  type SerialBaudRate,
  type SerialConsoleState,
} from './serialConsole';

export default function SerialView() {
  const { serial, settings } = useMeowKitBridge();
  const [state, setState] = useState<SerialConsoleState>(INITIAL_SERIAL_CONSOLE_STATE);
  const controllerRef = useRef<ReturnType<typeof createSerialConsoleController> | null>(null);

  useEffect(() => {
    const controller = createSerialConsoleController(serial, setState);
    controllerRef.current = controller;
    void (async () => {
      try {
        const prefs = await settings.get();
        const baud = prefs.serial.defaultBaudRate as SerialBaudRate;
        if ([9600, 115200, 921600].includes(baud)) {
          await controller.setBaudRate(baud);
        }
      } catch {
        // keep default baud
      }
      await controller.refresh();
    })();
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [serial, settings]);

  return (
    <Container header={<Header variant="h1">Serial</Header>}>
      <SpaceBetween direction="vertical" size="m">
        <SpaceBetween direction="horizontal" size="xs">
          <Select
            options={portsToSelectOptions(state.ports)}
            value={state.selectedPath}
            onChange={(path) => {
              void controllerRef.current?.connect(path);
            }}
            placeholder="Select serial port"
            aria-label="Serial port"
          />
          <Select
            options={baudRatesToSelectOptions()}
            value={String(state.baudRate)}
            onChange={(value) => {
              void controllerRef.current?.setBaudRate(Number(value) as SerialBaudRate);
            }}
            aria-label="Baud rate"
          />
          <Button
            variant="secondary"
            disabled={!state.connected}
            onClick={() => {
              void controllerRef.current?.disconnect();
            }}
          >
            Disconnect serial
          </Button>
          <Button
            variant="secondary"
            disabled={state.lines.length === 0}
            onClick={() => {
              void controllerRef.current?.saveLog();
            }}
          >
            Save log
          </Button>
          <Button
            variant="secondary"
            disabled={!state.connected}
            onClick={() => {
              void controllerRef.current?.reset();
            }}
          >
            Reset device
          </Button>
        </SpaceBetween>
        <Box color="muted" fontSize="sm">
          Stock firmware has no ping/hello command. Best RX check: reset the board and watch boot
          logs, or send MK+REBOOT_DL (expect no ACK until firmware supports soft download).
        </Box>
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
