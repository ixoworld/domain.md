import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repositoryRoot = resolve(packageRoot, '../..');

export async function example(name = 'project-authoring'): Promise<string> {
  return readFile(resolve(repositoryRoot, 'examples', name, 'domain.md'), 'utf8');
}

export function protocolManifestUri(): string {
  return pathToFileURL(resolve(repositoryRoot, 'examples/protocol-domain/template-manifest.yaml'))
    .href;
}

export async function protocolParameters(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(resolve(repositoryRoot, 'examples/protocol-domain/parameters.json'), 'utf8'),
  ) as Record<string, unknown>;
}
