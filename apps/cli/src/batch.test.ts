import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '@context-compiler/config';
import {
  analyzeDirectory,
  lintDirectory,
  optimizeDirectory,
  optimizeInput,
} from './batch.js';
import type { DirectoryFilters } from './batch.js';

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

  it('applies --only optimize controls and records transform metadata', () => {
    const result = optimizeInput(
      {
        path: '<text>',
        content: 'Repeat this.\n\nRepeat this.',
        ext: '.txt',
      },
      defaultConfig,
      { mode: 'only', requestedIds: ['remove-exact-duplicates'] },
    );

    expect(result.appliedChanges.map(change => change.transformId)).toEqual([
      'remove-exact-duplicates',
    ]);
    expect(result.transformSelection).toEqual({
      mode: 'only',
      activeTransformIds: ['remove-exact-duplicates'],
      requestedIds: ['remove-exact-duplicates'],
    });
  });

  it('applies --except optimize controls in directory mode', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await writeFile(join(cwd, 'a.md'), 'Repeat this.\n\nRepeat this.', 'utf8');

      const result = await optimizeDirectory(cwd, defaultConfig, {
        controls: { mode: 'except', requestedIds: ['remove-exact-duplicates'] },
      });

      expect(result.summary.filesChanged).toBe(0);
      expect(result.transformSelection?.mode).toBe('except');
      expect(result.transformSelection?.requestedIds).toEqual(['remove-exact-duplicates']);
      expect(result.transformSelection?.activeTransformIds).not.toContain('remove-exact-duplicates');
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

  it('analyzeDirectory with --include processes only matching files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await mkdir(join(cwd, 'prompts'));
      await mkdir(join(cwd, 'examples'));
      await writeFile(join(cwd, 'prompts', 'a.md'), 'You are helpful.', 'utf8');
      await writeFile(join(cwd, 'examples', 'b.md'), 'Do not lie.', 'utf8');

      const filters: DirectoryFilters = { include: ['prompts'], exclude: [] };
      const result = await analyzeDirectory(cwd, defaultConfig, { filters });

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.path).toContain('prompts');
      expect(result.filters).toEqual(filters);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('lintDirectory with --exclude skips matching files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await writeFile(join(cwd, 'a.md'), 'You are an assistant.', 'utf8');
      await mkdir(join(cwd, 'drafts'));
      await writeFile(join(cwd, 'drafts', 'b.md'), 'Draft content.', 'utf8');

      const filters: DirectoryFilters = { include: [], exclude: ['drafts'] };
      const result = await lintDirectory(cwd, defaultConfig, { filters });

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.path).not.toContain('drafts');
      expect(result.filters).toEqual(filters);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('optimizeDirectory: exclude wins over include for the same file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await writeFile(join(cwd, 'a.md'), 'Repeat this.\n\nRepeat this.', 'utf8');

      const filters: DirectoryFilters = { include: ['*.md'], exclude: ['a.md'] };
      await expect(
        optimizeDirectory(cwd, defaultConfig, { filters }),
      ).rejects.toThrow('No supported files matched');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('analyzeDirectory filters leaving zero files propagates error', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await writeFile(join(cwd, 'a.md'), 'Content.', 'utf8');

      const filters: DirectoryFilters = { include: ['nonexistent/**'], exclude: [] };
      await expect(
        analyzeDirectory(cwd, defaultConfig, { filters }),
      ).rejects.toThrow('No supported files matched filters');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('result filters field is absent when no filters active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await writeFile(join(cwd, 'a.md'), 'Content.', 'utf8');
      const result = await analyzeDirectory(cwd, defaultConfig);
      expect(result.filters).toBeUndefined();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('directory ordering remains deterministic after filtering', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-batch-'));
    try {
      await mkdir(join(cwd, 'prompts'));
      await writeFile(join(cwd, 'prompts', 'z.md'), 'Z', 'utf8');
      await writeFile(join(cwd, 'prompts', 'a.md'), 'A', 'utf8');
      await writeFile(join(cwd, 'other.md'), 'Other', 'utf8');

      const filters: DirectoryFilters = { include: ['prompts'], exclude: [] };
      const result = await analyzeDirectory(cwd, defaultConfig, { filters });

      const paths = result.files.map(f => f.path);
      expect(paths).toEqual([...paths].sort());
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
