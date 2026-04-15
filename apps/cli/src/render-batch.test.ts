import { describe, expect, it } from 'vitest';
import type { AnalysisReport, OptimizationResult } from '@context-compiler/core';
import type { LintResult } from '@context-compiler/rules';
import type {
  AnalyzeDirectoryResult,
  LintDirectoryResult,
  OptimizeDirectoryResult,
} from './batch.js';
import {
  renderAnalyzeDirectoryJson,
  renderAnalyzeDirectoryText,
  renderLintDirectoryJson,
  renderLintDirectoryText,
  renderOptimizeDirectoryJson,
  renderOptimizeDirectoryText,
} from './render-batch.js';

const reportA: AnalysisReport = {
  path: '/tmp/prompts/a.md',
  tokenizer: { id: 'char' },
  blocks: [],
  issues: [],
  totalBlocks: 2,
  totalTokens: 10,
  createdAt: new Date('2024-01-01'),
};

const reportB: AnalysisReport = {
  ...reportA,
  path: '/tmp/prompts/b.md',
  totalBlocks: 1,
  totalTokens: 5,
  issues: [{ ruleId: 'block-too-long', severity: 'warning', message: 'Long block' }],
};

describe('directory batch renderers', () => {
  it('renders analyze directory summary text and JSON', () => {
    const result: AnalyzeDirectoryResult = {
      path: '/tmp/prompts',
      kind: 'directory',
      files: [reportA, reportB],
      summary: { filesProcessed: 2, totalBlocks: 3, totalTokens: 15, warningCount: 1 },
    };

    const text = renderAnalyzeDirectoryText(result);
    expect(text).toContain('Files processed: 2');
    expect(text).toContain('Total blocks: 3');

    const parsed = JSON.parse(renderAnalyzeDirectoryJson(result)) as AnalyzeDirectoryResult;
    expect(parsed.kind).toBe('directory');
    expect(parsed.files).toHaveLength(2);
  });

  it('renders lint directory summary text and JSON', () => {
    const lintResult: LintResult = {
      rulesRun: ['duplicated-instruction'],
      issues: [{ ruleId: 'duplicated-instruction', severity: 'error', message: 'Duplicate' }],
    };
    const result: LintDirectoryResult = {
      path: '/tmp/prompts',
      kind: 'directory',
      files: [{ path: reportA.path, report: reportA, result: lintResult }],
      summary: {
        filesProcessed: 1,
        totalIssues: 1,
        issuesBySeverity: { error: 1, warning: 0, info: 0 },
      },
    };

    const text = renderLintDirectoryText(result);
    expect(text).toContain('Total issues: 1');
    expect(text).toContain('error:duplicated-instruction');

    const parsed = JSON.parse(renderLintDirectoryJson(result)) as LintDirectoryResult;
    expect(parsed.summary.issuesBySeverity.error).toBe(1);
  });

  it('renders optimize directory non-writing status', () => {
    const result = optimizeDirectoryResult();
    const text = renderOptimizeDirectoryText(result);
    expect(text).toContain('Files changed: 1');
    expect(text).toContain('Files not written. Use --write to apply directory changes.');
  });

  it('renders optimize directory diff only for changed files', () => {
    const result = optimizeDirectoryResult();
    const text = renderOptimizeDirectoryText(result, { diff: true });
    expect(text).toContain('/tmp/prompts/a.md');
    expect(text).toContain('remove-exact-duplicates');
    expect(text).not.toContain('/tmp/prompts/b.md');
  });

  it('renders optimize directory JSON', () => {
    const parsed = JSON.parse(renderOptimizeDirectoryJson(optimizeDirectoryResult())) as OptimizeDirectoryResult;
    expect(parsed.kind).toBe('directory');
    expect(parsed.summary.filesChanged).toBe(1);
  });
});

function optimizeDirectoryResult(): OptimizeDirectoryResult {
  const changed: OptimizationResult = {
    path: '/tmp/prompts/a.md',
    tokenizer: { id: 'char' },
    originalContent: 'Repeat this.\n\nRepeat this.',
    optimizedContent: 'Repeat this.',
    originalTokens: 6,
    optimizedTokens: 3,
    tokenSavings: 3,
    appliedChanges: [
      {
        type: 'remove',
        transformId: 'remove-exact-duplicates',
        blockIds: ['block-1', 'block-2'],
        primaryBlockId: 'block-2',
        before: 'Repeat this.',
        reason: 'Exact duplicate of block-1',
        tokenDelta: -3,
      },
    ],
  };
  const unchanged: OptimizationResult = {
    path: '/tmp/prompts/b.md',
    tokenizer: { id: 'char' },
    originalContent: 'Unique.',
    optimizedContent: 'Unique.',
    originalTokens: 2,
    optimizedTokens: 2,
    tokenSavings: 0,
    appliedChanges: [],
  };

  return {
    path: '/tmp/prompts',
    kind: 'directory',
    files: [changed, unchanged],
    summary: {
      filesProcessed: 2,
      filesChanged: 1,
      filesWritten: 0,
      totalOriginalTokens: 8,
      totalOptimizedTokens: 5,
      totalSavings: 3,
      totalChangesApplied: 1,
    },
  };
}
