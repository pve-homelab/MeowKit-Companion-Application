import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { getTemplate, type TemplateId } from '../../../shared/templates';
import { resolvePathUnderRoot } from './workspace-service';

export async function scaffoldTemplate(
  rootPath: string,
  templateId: TemplateId,
): Promise<void> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  for (const file of template.files) {
    const target = resolvePathUnderRoot(rootPath, file.path);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }

  // Ensure expected project folders exist even if empty.
  for (const folder of ['src', 'apps', 'firmware', 'assets']) {
    await fs.mkdir(join(rootPath, folder), { recursive: true });
  }
}
