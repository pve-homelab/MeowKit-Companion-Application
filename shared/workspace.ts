export interface WorkspaceFileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: WorkspaceFileNode[];
}
