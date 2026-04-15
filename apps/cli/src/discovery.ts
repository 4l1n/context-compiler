import { readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.json']);
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', '.turbo']);

export async function discoverSupportedFiles(rootPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sorted) {
      const entryPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          await walk(entryPath);
        }
        continue;
      }

      if (entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push(entryPath);
      }
    }
  }

  await walk(rootPath);

  files.sort((a, b) => normalizeRelative(rootPath, a).localeCompare(normalizeRelative(rootPath, b)));

  if (files.length === 0) {
    throw new Error(`No supported files found in directory: ${rootPath}`);
  }

  return files;
}

function normalizeRelative(rootPath: string, filePath: string): string {
  return relative(rootPath, filePath).split(sep).join('/');
}
