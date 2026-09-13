export interface CatalogApp {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
}

export interface AppsCatalogFile {
  apps: CatalogApp[];
}
