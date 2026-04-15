import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverSupportedFiles } from './discovery.js';

describe('discoverSupportedFiles', () => {
  it('recurses and returns supported files in deterministic order', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-discovery-'));
    try {
      await mkdir(join(cwd, 'b'));
      await mkdir(join(cwd, 'a'));
      await writeFile(join(cwd, 'z.txt'), 'z', 'utf8');
      await writeFile(join(cwd, 'a', 'prompt.md'), 'a', 'utf8');
      await writeFile(join(cwd, 'b', 'data.json'), '{}', 'utf8');
      await writeFile(join(cwd, 'b', 'ignored.js'), 'ignored', 'utf8');

      const files = await discoverSupportedFiles(cwd);

      expect(files).toEqual([
        join(cwd, 'a', 'prompt.md'),
        join(cwd, 'b', 'data.json'),
        join(cwd, 'z.txt'),
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('skips common generated and dependency directories', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-discovery-'));
    try {
      for (const dir of ['.git', 'node_modules', 'dist', 'build', '.turbo']) {
        await mkdir(join(cwd, dir));
        await writeFile(join(cwd, dir, 'ignored.md'), 'ignored', 'utf8');
      }
      await writeFile(join(cwd, 'kept.md'), 'kept', 'utf8');

      const files = await discoverSupportedFiles(cwd);

      expect(files).toEqual([join(cwd, 'kept.md')]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('throws with the directory path when no supported files are found', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-discovery-'));
    try {
      await writeFile(join(cwd, 'ignored.js'), 'ignored', 'utf8');
      await expect(discoverSupportedFiles(cwd)).rejects.toThrow(
        `No supported files found in directory: ${cwd}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
