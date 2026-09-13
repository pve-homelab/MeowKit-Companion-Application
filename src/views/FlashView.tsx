import Container from '@meowkit/components/container';
import FirmwareFlashingPanel from '@meowkit/components/firmware-flashing-panel';
import Header from '@meowkit/components/header';

export default function FlashView() {
  return (
    <Container header={<Header variant="h1">Flash</Header>}>
      <FirmwareFlashingPanel status="idle" onConnect={() => undefined} onFlash={() => undefined} />
    </Container>
  );
}
