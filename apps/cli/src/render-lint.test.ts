import { describe, it, expect } from 'vitest';
import { renderLintText, renderLintJson } from './render-lint.js';
import type { AnalysisReport } from '@context-compiler/core';
import type { LintResult } from '@context-compiler/rules';

const baseReport: AnalysisReport = {
  path: '/tmp/prompt.md',
  blocks: [
    { id: 'block-1', content: 'You are a helpful assistant.', type: 'instruction', tokenCount: 7, tokenPercent: 70 },
    { id: 'block-2', content: 'Do not lie.', type: 'constraint', tokenCount: 3, tokenPercent: 30 },
  ],
  issues: [],
  totalBlocks: 2,
  totalTokens: 10,
  createdAt: new Date('2024-01-01'),
};

const cleanResult: LintResult = {
  issues: [],
  rulesRun: ['duplicated-instruction', 'noisy-tool-output'],
};

const issueResult: LintResult = {
  issues: [
    { ruleId: 'duplicated-instruction', severity: 'error', message: 'Exact duplicate of block-1', blockId: 'block-2' },
    { ruleId: 'noisy-tool-output', severity: 'warning', message: 'Tool output is 400 tokens', blockId: 'block-3' },
  ],
  rulesRun: ['duplicated-instruction', 'noisy-tool-output'],
};

describe('renderLintText', () => {
  it('shows file path', () => {
    expect(renderLintText(baseReport, cleanResult)).toContain('/tmp/prompt.md');
  });

  it('shows rules that ran', () => {
    const out = renderLintText(baseReport, cleanResult);
    expect(out).toContain('duplicated-instruction');
    expect(out).toContain('noisy-tool-output');
  });

  it('shows no-issues message when clean', () => {
    expect(renderLintText(baseReport, cleanResult)).toContain('No issues found');
  });

  it('shows issue count in header', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('2 issues');
  });

  it('shows error icon for errors', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('✗');
  });

  it('shows warning icon for warnings', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('!');
  });

  it('shows block id in output', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('[block-2]');
  });

  it('shows issue message', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('Exact duplicate of block-1');
  });

  it('shows singular "1 issue" label', () => {
    const singleIssue: LintResult = {
      issues: [{ ruleId: 'test', severity: 'warning', message: 'one' }],
      rulesRun: ['test'],
    };
    expect(renderLintText(baseReport, singleIssue)).toContain('1 issue');
    expect(renderLintText(baseReport, singleIssue)).not.toContain('1 issues');
  });

  it('sorts errors before warnings', () => {
    const out = renderLintText(baseReport, issueResult);
    const errorPos = out.indexOf('✗');
    const warnPos = out.indexOf('!');
    expect(errorPos).toBeLessThan(warnPos);
  });

  it('marks analysis issues with (analysis) label', () => {
    const reportWithIssue: AnalysisReport = {
      ...baseReport,
      issues: [{ ruleId: 'block-too-long', severity: 'warning', message: 'Block is long', blockId: 'block-1' }],
    };
    expect(renderLintText(reportWithIssue, cleanResult)).toContain('(analysis)');
  });
});

describe('renderLintJson', () => {
  it('returns valid JSON', () => {
    expect(() => JSON.parse(renderLintJson(baseReport, cleanResult))).not.toThrow();
  });

  it('includes rulesRun', () => {
    const parsed = JSON.parse(renderLintJson(baseReport, cleanResult)) as { rulesRun: string[] };
    expect(parsed.rulesRun).toEqual(['duplicated-instruction', 'noisy-tool-output']);
  });

  it('separates analysisIssues and lintIssues', () => {
    const parsed = JSON.parse(renderLintJson(baseReport, issueResult)) as {
      analysisIssues: unknown[];
      lintIssues: unknown[];
    };
    expect(Array.isArray(parsed.analysisIssues)).toBe(true);
    expect(Array.isArray(parsed.lintIssues)).toBe(true);
  });

  it('includes allIssues as combined sorted list', () => {
    const parsed = JSON.parse(renderLintJson(baseReport, issueResult)) as { allIssues: unknown[] };
    expect(parsed.allIssues).toHaveLength(2);
  });
});
