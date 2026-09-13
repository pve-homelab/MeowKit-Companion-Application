import Alert from '@meowkit/components/alert';
import BuildOutputPanel, { type BuildOutputStatus } from '@meowkit/components/build-output-panel';
import Button from '@meowkit/components/button';
import FileExplorerTree, { type FileExplorerNode } from '@meowkit/components/file-explorer-tree';
import IDEToolbar from '@meowkit/components/ide-toolbar';
import MonacoEditor from '@meowkit/components/monaco-editor';
import Select from '@meowkit/components/select';
import SpaceBetween from '@meowkit/components/space-between';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROJECT_TEMPLATES } from '../../shared/templates';
import { useMeowKitBridge } from '../hooks/useMeowKitBridge';
import '../ide-layout.css';
import { fileTree as sampleTree, initialBuildLines, mockFiles } from './ideMockFiles';

const editorOptions = {
  minimap: { enabled: false },
  fontSize: 14,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
} as const;

function languageForFile(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ino':
    case 'cpp':
    case 'c':
    case 'h':
    case 'hpp':
      return 'cpp';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'csv':
      return 'plaintext';
    default:
      return 'plaintext';
  }
}

function collectFolderIds(nodes: FileExplorerNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      ids.push(node.id);
      if (node.children?.length) {
        ids.push(...collectFolderIds(node.children));
      }
    }
  }
  return ids;
}

function findNode(nodes: FileExplorerNode[], id: string): FileExplorerNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

export default function IdeView() {
  const meowkit = useMeowKitBridge();
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileExplorerNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [buildLines, setBuildLines] = useState(initialBuildLines);
  const [buildStatus, setBuildStatus] = useState<BuildOutputStatus>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorHostRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState(480);

  const activeName = selectedId ? basename(selectedId) : '';
  const editorValue = editorValues[selectedId] ?? '';

  useEffect(() => {
    const host = editorHostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;

    const syncHeight = () => {
      const next = Math.floor(host.getBoundingClientRect().height);
      if (next > 0) setEditorHeight(next);
    };

    syncHeight();
    const observer = new ResizeObserver(() => syncHeight());
    observer.observe(host);
    window.addEventListener('resize', syncHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, [projectPath, selectedId]);

  useEffect(() => {
    void meowkit.workspace.getRecent().then(setRecent).catch(() => setRecent([]));
  }, [meowkit.workspace]);

  useEffect(() => meowkit.build.onLog((line) => setBuildLines((lines) => [...lines, line])), [
    meowkit.build,
  ]);

  const applyTree = useCallback((path: string, tree: FileExplorerNode[]) => {
    setProjectPath(path);
    setFileTree(tree);
    setExpandedIds(collectFolderIds(tree));
    setOpenTabs([]);
    setSelectedId('');
    setEditorValues({});
    setDirtyIds([]);
    setError(null);
  }, []);

  const loadProject = useCallback(
    async (path: string) => {
      setBusy(true);
      setError(null);
      try {
        await meowkit.workspace.addRecent(path);
        const tree = await meowkit.workspace.readTree();
        applyTree(path, tree);
        setRecent(await meowkit.workspace.getRecent());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setBuildLines((lines) => [...lines, `Failed to open project: ${message}`]);
        setBuildStatus('error');
      } finally {
        setBusy(false);
      }
    },
    [applyTree, meowkit.workspace],
  );

  const handleOpenFolder = useCallback(async () => {
    setBusy(true);
    try {
      const path = await meowkit.workspace.pickFolder();
      if (!path) return;
      await loadProject(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [loadProject, meowkit.workspace]);

  const handleOpenSample = useCallback(() => {
    const contents = Object.fromEntries(
      Object.values(mockFiles).map((file) => [file.path, file.content]),
    );
    applyTree('sample://meowkit-project', sampleTree);
    setEditorValues(contents);
    setOpenTabs(['src/main.py']);
    setSelectedId('src/main.py');
    setBuildLines(['Opened sample workspace (browser / mock).']);
    setBuildStatus('idle');
  }, [applyTree]);

  const handleCreateFromTemplate = useCallback(
    async (templateId: string) => {
      if (!templateId) return;
      setBusy(true);
      setError(null);
      try {
        const path = await meowkit.workspace.createFromTemplate(templateId);
        if (!path) return;
        await loadProject(path);
        setBuildLines([`Created project from template ${templateId}.`]);
        setBuildStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [loadProject, meowkit.workspace],
  );

  const openFile = useCallback(
    async (id: string) => {
      const node = findNode(fileTree, id);
      if (node?.type === 'folder') return;

      setSelectedId(id);
      setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]));

      if (editorValues[id] !== undefined || loadingFile) return;

      setLoadingFile(true);
      try {
        const content = await meowkit.workspace.readFile(id);
        setEditorValues((current) => ({ ...current, [id]: content }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setBuildStatus('error');
      } finally {
        setLoadingFile(false);
      }
    },
    [editorValues, fileTree, loadingFile, meowkit.workspace],
  );

  const handleEditorChange = useCallback(
    (value: string) => {
      if (!selectedId) return;
      setEditorValues((current) => ({ ...current, [selectedId]: value }));
      setDirtyIds((ids) => (ids.includes(selectedId) ? ids : [...ids, selectedId]));
    },
    [selectedId],
  );

  const handleSave = useCallback(async () => {
    if (!selectedId || projectPath?.startsWith('sample://')) {
      setBuildLines((lines) => [...lines, 'Sample workspace is read-only in the browser preview.']);
      return;
    }
    setBusy(true);
    try {
      await meowkit.workspace.writeFile(selectedId, editorValues[selectedId] ?? '');
      setDirtyIds((ids) => ids.filter((id) => id !== selectedId));
      setBuildLines((lines) => [...lines, `Saved ${selectedId}.`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBuildStatus('error');
    } finally {
      setBusy(false);
    }
  }, [editorValues, meowkit.workspace, projectPath, selectedId]);

  const handleBuild = useCallback(async () => {
    if (!projectPath || projectPath.startsWith('sample://')) {
      setBuildStatus('error');
      setBuildLines(['Open a real project folder before building.']);
      return;
    }
    setBusy(true);
    setBuildStatus('busy');
    setBuildLines([]);
    try {
      const result = await meowkit.build.run({ projectPath });
      setBuildStatus(result.ok ? 'success' : 'error');
    } catch (err) {
      setBuildStatus('error');
      setBuildLines((lines) => [
        ...lines,
        `Build failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    } finally {
      setBusy(false);
    }
  }, [meowkit.build, projectPath]);

  const tabItems = useMemo(
    () =>
      openTabs.map((id) => ({
        id,
        label: `${basename(id)}${dirtyIds.includes(id) ? ' •' : ''}`,
      })),
    [dirtyIds, openTabs],
  );

  const closeTab = useCallback(
    (id: string) => {
      setOpenTabs((tabs) => {
        const next = tabs.filter((tab) => tab !== id);
        if (selectedId === id) {
          setSelectedId(next[next.length - 1] ?? '');
        }
        return next;
      });
    },
    [selectedId],
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        height: 'calc(100vh - 96px)',
        minHeight: 560,
        gap: 12,
      }}
    >
      <IDEToolbar
        busy={busy}
        onSave={selectedId ? () => void handleSave() : undefined}
        onBuild={() => void handleBuild()}
        left={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="secondary" disabled={busy} onClick={() => void handleOpenFolder()}>
              Open folder
            </Button>
            <Button variant="ghost" disabled={busy} onClick={handleOpenSample}>
              Sample project
            </Button>
            <Select
              aria-label="New from template"
              placeholder="New from template…"
              options={PROJECT_TEMPLATES.map((template) => ({
                value: template.id,
                label: template.label,
              }))}
              value={undefined}
              disabled={busy}
              onChange={(id) => void handleCreateFromTemplate(id)}
            />
            {recent.length > 0 ? (
              <Select
                aria-label="Recent projects"
                placeholder="Recent…"
                options={recent.map((path) => ({ value: path, label: basename(path) }))}
                value={undefined}
                disabled={busy}
                onChange={(path) => void loadProject(path)}
              />
            ) : null}
          </SpaceBetween>
        }
      >
        {projectPath ?? 'No project open'}
      </IDEToolbar>

      {error ? <Alert type="error">{error}</Alert> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px minmax(0, 1fr)',
          gap: 12,
          minHeight: 0,
          height: '100%',
        }}
      >
        <div
          style={{
            overflow: 'auto',
            border: '1px solid var(--mk-color-border)',
            borderRadius: 'var(--mk-radius-md)',
            background: 'var(--mk-color-surface)',
            padding: 8,
            minHeight: 0,
          }}
        >
          {fileTree.length > 0 ? (
            <FileExplorerTree
              nodes={fileTree}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={(id) => void openFile(id)}
              onExpandedChange={setExpandedIds}
            />
          ) : (
            <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
              Open a folder, pick a template, or load the sample project.
            </p>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateRows: openTabs.length ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
            minHeight: 0,
            height: '100%',
            border: '1px solid var(--mk-color-border)',
            borderRadius: 'var(--mk-radius-md)',
            overflow: 'hidden',
            background: 'var(--mk-color-surface)',
          }}
        >
          {tabItems.length > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 8px',
                borderBottom: '1px solid var(--mk-color-border)',
                overflowX: 'auto',
              }}
            >
              {tabItems.map((tab) => (
                <Button
                  key={tab.id}
                  variant={tab.id === selectedId ? 'primary' : 'ghost'}
                  onClick={() => void openFile(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
              {selectedId ? (
                <Button variant="ghost" onClick={() => closeTab(selectedId)}>
                  Close
                </Button>
              ) : null}
            </div>
          ) : null}
          <div ref={editorHostRef} style={{ minHeight: 0, height: '100%' }}>
            {selectedId ? (
              <MonacoEditor
                key={selectedId}
                value={editorValue}
                onChange={handleEditorChange}
                language={languageForFile(activeName)}
                path={selectedId}
                height={Math.max(editorHeight, 240)}
                options={editorOptions}
              />
            ) : (
              <p style={{ padding: 16 }}>
                Select a file from the project tree. Monaco supports multi-file tabs, syntax
                highlighting, and folding.
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxHeight: 160, overflow: 'auto' }}>
        <BuildOutputPanel
          lines={buildLines}
          status={buildStatus}
          onClear={
            buildLines.length > 0
              ? () => {
                  setBuildLines([]);
                  setBuildStatus('idle');
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
