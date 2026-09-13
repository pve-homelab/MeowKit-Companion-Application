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
      { id: 'src/main.ino', name: 'main.ino', type: 'file' },
      { id: 'src/main.py', name: 'main.py', type: 'file' },
    ],
  },
  {
    id: 'apps',
    name: 'apps',
    type: 'folder',
    children: [{ id: 'apps/manifest.json', name: 'manifest.json', type: 'file' }],
  },
  {
    id: 'firmware',
    name: 'firmware',
    type: 'folder',
    children: [{ id: 'firmware/partitions.csv', name: 'partitions.csv', type: 'file' }],
  },
  {
    id: 'assets',
    name: 'assets',
    type: 'folder',
    children: [{ id: 'assets/README.md', name: 'README.md', type: 'file' }],
  },
  { id: 'config.json', name: 'config.json', type: 'file' },
  { id: 'README.md', name: 'README.md', type: 'file' },
];

export const defaultExpandedIds = ['src', 'apps', 'firmware', 'assets'];
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
  'app-manifest': {
    label: 'manifest.json',
    path: 'apps/manifest.json',
    language: 'json',
    content: `{
  "apps": ["retrotv", "audio-pad"]
}
`,
  },
  partition: {
    label: 'partitions.csv',
    path: 'firmware/partitions.csv',
    language: 'plaintext',
    content: `# Name, Type, SubType, Offset, Size
nvs, data, nvs, 0x9000, 0x5000
app0, app, ota_0, 0x10000, 0xC80000
`,
  },
  'asset-readme': {
    label: 'README.md',
    path: 'assets/README.md',
    language: 'markdown',
    content: `# Assets

Drop IR codes, audio, and images here for packaging onto the device SD card.
`,
  },
  config: {
    label: 'config.json',
    path: 'config.json',
    language: 'json',
    content: `{
  "board": "meowkit-s3",
  "baud": 115200
}
`,
  },
  readme: {
    label: 'README.md',
    path: 'README.md',
    language: 'markdown',
    content: `# Companion workspace

Folders mirror the planned MeowKit project layout: src, apps, firmware, assets.
`,
  },
};

export const initialBuildLines = [
  'Ready to build.',
  'Select Build in the toolbar to compile the active sketch.',
];
