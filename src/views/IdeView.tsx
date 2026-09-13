import BuildOutputPanel, { type BuildOutputStatus } from '@meowkit/components/build-output-panel';
import FileExplorerTree from '@meowkit/components/file-explorer-tree';
import IDEToolbar from '@meowkit/components/ide-toolbar';
import MonacoEditor from '@meowkit/components/monaco-editor';
import { useCallback, useState } from 'react';
import {
  defaultExpandedIds,
  defaultSelectedId,
  fileTree,
  initialBuildLines,
  mockFiles,
} from './ideMockFiles';

const editorOptions = {
  minimap: { enabled: false },
  fontSize: 14,
  automaticLayout: true,
} as const;

export default function IdeView() {
  const [expandedIds, setExpandedIds] = useState(defaultExpandedIds);
  const [selectedId, setSelectedId] = useState(defaultSelectedId);
  const [editorValues, setEditorValues] = useState(() =>
    Object.fromEntries(Object.entries(mockFiles).map(([id, file]) => [id, file.content])),
  );
  const [buildLines, setBuildLines] = useState(initialBuildLines);
  const [buildStatus, setBuildStatus] = useState<BuildOutputStatus>('idle');
  const [busy, setBusy] = useState(false);

  const activeFile = mockFiles[selectedId];
  const editorValue = editorValues[selectedId] ?? '';

  const handleEditorChange = useCallback(
    (value: string) => {
      setEditorValues((current) => ({ ...current, [selectedId]: value }));
    },
    [selectedId],
  );

  const handleSave = useCallback(() => {
    setBuildLines((lines) => [...lines, `Saved ${activeFile?.path ?? 'workspace'} (local stub).`]);
  }, [activeFile?.path]);

  const handleBuild = useCallback(() => {
    setBusy(true);
    setBuildStatus('busy');
    setBuildLines(['Compiling sketch...']);

    window.setTimeout(() => {
      setBusy(false);
      setBuildStatus('success');
      setBuildLines([
        'Compiling sketch...',
        'Sketch uses 1234 bytes (4%) of program storage space.',
        'Build stub complete (no toolchain).',
      ]);
    }, 900);
  }, []);

  const handleClearBuild = useCallback(() => {
    setBuildLines([]);
    setBuildStatus('idle');
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        gap: 12,
      }}
    >
      <IDEToolbar busy={busy} left="MeowKitIDE" onSave={handleSave} onBuild={handleBuild}>
        {activeFile?.label ?? 'Untitled'}
      </IDEToolbar>
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          gap: 12,
        }}
      >
        <div style={{ width: 220, minWidth: 180, overflow: 'auto' }}>
          <FileExplorerTree
            nodes={fileTree}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={setSelectedId}
            onExpandedChange={setExpandedIds}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {activeFile ? (
            <MonacoEditor
              key={selectedId}
              value={editorValue}
              onChange={handleEditorChange}
              language={activeFile.language}
              path={activeFile.path}
              height="100%"
              options={editorOptions}
            />
          ) : (
            <p>Select a file from the project tree.</p>
          )}
        </div>
      </div>
      <BuildOutputPanel
        lines={buildLines}
        status={buildStatus}
        onClear={buildLines.length > 0 ? handleClearBuild : undefined}
      />
    </div>
  );
}
