import Container from '@meowkit/components/container';
import Header from '@meowkit/components/header';
import SerialConsoleView from '@meowkit/components/serial-console-view';

export default function SerialView() {
  return (
    <Container header={<Header variant="h1">Serial</Header>}>
      <SerialConsoleView lines={[]} onSend={() => undefined} connected={false} />
    </Container>
  );
}
