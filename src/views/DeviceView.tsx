import Container from '@meowkit/components/container';
import DeviceManagerPanel from '@meowkit/components/device-manager-panel';
import Header from '@meowkit/components/header';

export default function DeviceView() {
  return (
    <Container header={<Header variant="h1">Device</Header>}>
      <DeviceManagerPanel devices={[]} />
    </Container>
  );
}
