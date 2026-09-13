import Alert from '@meowkit/components/alert';
import Button from '@meowkit/components/button';
import Checkbox from '@meowkit/components/checkbox';
import Container from '@meowkit/components/container';
import FormField from '@meowkit/components/form-field';
import Header from '@meowkit/components/header';
import Input from '@meowkit/components/input';
import Select from '@meowkit/components/select';
import SpaceBetween from '@meowkit/components/space-between';
import { useCallback, useEffect, useState } from 'react';
import type { CompanionSettings, SettingsPatch } from '../../shared/ipc';
import { DEFAULT_SETTINGS, type ToolchainKind } from '../../shared/settings';
import { useMeowKitBridge } from '../hooks/useMeowKitBridge';

const BAUD_OPTIONS = [
  { value: '9600', label: '9600' },
  { value: '19200', label: '19200' },
  { value: '38400', label: '38400' },
  { value: '57600', label: '57600' },
  { value: '115200', label: '115200' },
  { value: '230400', label: '230400' },
  { value: '460800', label: '460800' },
  { value: '921600', label: '921600' },
];

const TOOLCHAIN_OPTIONS: Array<{ value: ToolchainKind; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'arduino', label: 'Arduino CLI' },
  { value: 'esp-idf', label: 'ESP-IDF' },
];

export default function SettingsView() {
  const bridge = useMeowKitBridge();
  const settingsApi = bridge.settings;
  const [draft, setDraft] = useState<CompanionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!settingsApi?.get) {
      setError('Settings API unavailable. Restart the Companion app to reload the preload bridge.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void settingsApi
      .get()
      .then((loaded) => {
        if (!cancelled) setDraft(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load settings');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [settingsApi]);

  const updateDraft = useCallback((patch: SettingsPatch) => {
    setSaved(false);
    setDraft((current) => ({
      serial: { ...current.serial, ...patch.serial },
      ide: { ...current.ide, ...patch.ide },
      theme: { ...current.theme, ...patch.theme },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!settingsApi?.set) {
      setError('Settings API unavailable.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await settingsApi.set({
        serial: draft.serial,
        ide: {
          toolchain: draft.ide.toolchain,
          toolchainPath: draft.ide.toolchainPath,
        },
      });
      setDraft(next);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [draft.ide.toolchain, draft.ide.toolchainPath, draft.serial, settingsApi]);

  return (
    <Container
      header={
        <Header variant="h1" description="Serial defaults, toolchain paths, and recent projects.">
          Settings
        </Header>
      }
    >
      <SpaceBetween direction="vertical" size="l">
        {loading ? <Alert type="info">Loading settings…</Alert> : null}
        {error ? <Alert type="error">{error}</Alert> : null}
        {saved ? <Alert type="success">Settings saved.</Alert> : null}

        <FormField label="Default baud rate" description="Used when opening a serial connection.">
          <Select
            aria-label="Default baud rate"
            options={BAUD_OPTIONS}
            value={String(draft.serial.defaultBaudRate)}
            disabled={loading || saving}
            onChange={(value) => updateDraft({ serial: { defaultBaudRate: Number(value) } })}
          />
        </FormField>

        <FormField label="Auto-reconnect" description="Reconnect automatically if the port drops.">
          <Checkbox
            checked={draft.serial.autoReconnect}
            disabled={loading || saving}
            onChange={(checked) => updateDraft({ serial: { autoReconnect: checked } })}
          >
            Enable auto-reconnect
          </Checkbox>
        </FormField>

        <FormField label="Toolchain" description="Build toolchain for the IDE workspace.">
          <Select
            aria-label="Toolchain"
            options={TOOLCHAIN_OPTIONS}
            value={draft.ide.toolchain}
            disabled={loading || saving}
            onChange={(value) => updateDraft({ ide: { toolchain: value as ToolchainKind } })}
          />
        </FormField>

        <FormField
          label="Toolchain path"
          description="Path to arduino-cli or ESP-IDF export script."
        >
          <Input
            aria-label="Toolchain path"
            value={draft.ide.toolchainPath}
            disabled={loading || saving}
            onChange={(event) =>
              updateDraft({ ide: { toolchainPath: (event.target as HTMLInputElement).value } })
            }
            placeholder="C:\\tools\\arduino-cli.exe"
          />
        </FormField>

        <FormField
          label="Recent projects"
          description="Read-only list from workspace history (max 10)."
        >
          {draft.ide.recentProjects.length === 0 ? (
            <p>No recent projects yet. Open a folder in the IDE to populate this list.</p>
          ) : (
            <ul>
              {draft.ide.recentProjects.map((projectPath) => (
                <li key={projectPath}>{projectPath}</li>
              ))}
            </ul>
          )}
        </FormField>

        <FormField
          label="Debugging (preview)"
          description="GDB / OpenOCD paths arrive in a later release. Placeholder only."
        >
          <Input aria-label="GDB path" value="" disabled placeholder="Not configured yet" />
        </FormField>

        <Button variant="primary" disabled={loading || saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </SpaceBetween>
    </Container>
  );
}
