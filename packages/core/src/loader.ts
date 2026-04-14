import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json'] as const;
type SupportedExt = (typeof SUPPORTED_EXTENSIONS)[number];

function isSupportedExt(ext: string): ext is SupportedExt {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Read a file and return its content as a string.
 * JSON files are parsed and re-serialized as readable text before returning.
 */
export async function loadFile(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();

  if (!isSupportedExt(ext)) {
    throw new Error(
      `Unsupported file type: "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    );
  }

  const raw = await readFile(filePath, 'utf-8');

  if (ext === '.json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in ${filePath}`);
    }
    return JSON.stringify(parsed, null, 2);
  }

  return raw;
}
