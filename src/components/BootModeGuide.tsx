import Alert from '@meowkit/components/alert';
import Button from '@meowkit/components/button';
import Header from '@meowkit/components/header';
import SpaceBetween from '@meowkit/components/space-between';
import { BOOT_CONFIRM_LABEL, BOOT_STEPS, MICROSD_NOTE } from './bootGuide';

export interface BootModeGuideProps {
  onConfirm: () => void;
}

export default function BootModeGuide({ onConfirm }: BootModeGuideProps) {
  return (
    <SpaceBetween direction="vertical" size="m">
      <Header variant="h2">Enter download mode</Header>
      <ol>
        {BOOT_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Alert type="info">{MICROSD_NOTE}</Alert>
      <Button variant="primary" onClick={onConfirm}>
        {BOOT_CONFIRM_LABEL}
      </Button>
    </SpaceBetween>
  );
}
