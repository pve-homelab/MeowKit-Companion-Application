import type { FileExplorerNode } from '@meowkit/components/file-explorer-tree';

export interface MockFile {
  content: string;
  language: string;
  path: string;
  label: string;
}

export const fileTree: FileExplorerNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    children: [
      { id: 'main-ino', name: 'main.ino', type: 'file' },
      { id: 'main-py', name: 'main.py', type: 'file' },
    ],
  },
  {
    id: 'lib',
    name: 'lib',
    type: 'folder',
    children: [{ id: 'utils', name: 'utils.py', type: 'file' }],
  },
  { id: 'readme', name: 'README.md', type: 'file' },
];

export const defaultExpandedIds = ['src', 'lib'];
export const defaultSelectedId = 'main-py';

export const mockFiles: Record<string, MockFile> = {
  'main-ino': {
    label: 'main.ino',
    path: 'src/main.ino',
    language: 'cpp',
    content: `#include <Arduino.h>

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.println("hello from MeowKit");
  delay(1000);
}
`,
  },
  'main-py': {
    label: 'main.py',
    path: 'src/main.py',
    language: 'python',
    content: `print("hello from MeowKit")

def blink():
    return True
`,
  },
  utils: {
    label: 'utils.py',
    path: 'lib/utils.py',
    language: 'python',
    content: `def format_port(name: str) -> str:
    return name.upper()
`,
  },
  readme: {
    label: 'README.md',
    path: 'README.md',
    language: 'markdown',
    content: `# Companion workspace

Edit sketches here, then use Build or Flash from the toolbar.
`,
  },
};

export const initialBuildLines = [
  'Ready to build.',
  'Select Build in the toolbar to compile the active sketch.',
];
