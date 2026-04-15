import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '@context-compiler/config';
import {
  analyzeDirectory,
  lintDirectory,
  optimizeDirectory,
} from './batch.js';

describe('directory batch orchestration', () => {
  it('summarizes analyze results across files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await writeFile(join(cwd, 'a.md'), 'You are helpful.', 'utf8');
      await writeFile(join(cwd, 'b.txt'), 'Do not lie.', 'utf8');

      const result = await analyzeDirectory(cwd, defaultConfig);

      expect(result.kind).toBe('directory');
      expect(result.files).toHaveLength(2);
      expect(result.summary.filesProcessed).toBe(2);
      expect(result.summary.totalBlocks).toBe(2);
      expect(result.summary.totalTokens).toBeGreaterThan(0);
      expect(result.summary.warningCount).toBe(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('summarizes lint issues and severities across files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await writeFile(
        join(cwd, 'a.md'),
        'You are an assistant.\n\nYou are an assistant.',
        'utf8',
      );
      await writeFile(join(cwd, 'b.md'), 'Unique content.', 'utf8');

      const result = await lintDirectory(cwd, defaultConfig);

      expect(result.summary.filesProcessed).toBe(2);
      expect(result.summary.totalIssues).toBeGreaterThanOrEqual(1);
      expect(result.summary.issuesBySeverity.error).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('summarizes optimize results across files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await writeFile(join(cwd, 'a.md'), 'Repeat this.\n\nRepeat this.', 'utf8');
      await writeFile(join(cwd, 'b.md'), 'Unique content.', 'utf8');

      const result = await optimizeDirectory(cwd, defaultConfig);

      expect(result.summary.filesProcessed).toBe(2);
      expect(result.summary.filesChanged).toBe(1);
      expect(result.summary.filesWritten).toBe(0);
      expect(result.summary.totalChangesApplied).toBe(1);
      expect(result.summary.totalSavings).toBeGreaterThan(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('writes only changed files after all files optimize successfully', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    const changedPath = join(cwd, 'a.md');
    const unchangedPath = join(cwd, 'b.md');
    try {
      await writeFile(changedPath, 'Repeat this.\n\nRepeat this.', 'utf8');
      await writeFile(unchangedPath, 'Unique content.', 'utf8');

      const result = await optimizeDirectory(cwd, defaultConfig, { write: true });

      expect(result.summary.filesWritten).toBe(1);
      expect(await readFile(changedPath, 'utf8')).toBe('Repeat this.');
      expect(await readFile(unchangedPath, 'utf8')).toBe('Unique content.');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('does not write any files when one file fails before the write phase', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    const changedPath = join(cwd, 'a.md');
    const invalidPath = join(cwd, 'bad.json');
    const original = 'Repeat this.\n\nRepeat this.';
    try {
      await writeFile(changedPath, original, 'utf8');
      await writeFile(invalidPath, '{ invalid json', 'utf8');

      await expect(optimizeDirectory(cwd, defaultConfig, { write: true })).rejects.toThrow(
        `Failed to optimize ${invalidPath}`,
      );
      expect(await readFile(changedPath, 'utf8')).toBe(original);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
