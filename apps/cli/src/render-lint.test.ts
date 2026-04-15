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

describe('renderLintText — header', () => {
  it('shows file path', () => {
    expect(renderLintText(baseReport, cleanResult)).toContain('/tmp/prompt.md');
  });

  it('shows rules that ran', () => {
    const out = renderLintText(baseReport, cleanResult);
    expect(out).toContain('duplicated-instruction');
    expect(out).toContain('noisy-tool-output');
  });

  it('shows block and token counts', () => {
    const out = renderLintText(baseReport, cleanResult);
    expect(out).toContain('2');
    expect(out).toContain('10');
  });

  it('shows tokenizer metadata when present', () => {
    const out = renderLintText(
      { ...baseReport, tokenizer: { id: 'o200k_base' } },
      cleanResult,
    );
    expect(out).toContain('Tokenizer: o200k_base');
  });
});

describe('renderLintText — Analysis warnings section', () => {
  it('shows "Analysis warnings (0)" when report has no issues', () => {
    expect(renderLintText(baseReport, cleanResult)).toContain('Analysis warnings (0)');
  });

  it('shows ✓ none when no analysis warnings', () => {
    expect(renderLintText(baseReport, cleanResult)).toContain('✓ none');
  });

  it('shows count when analysis warnings exist', () => {
    const reportWithIssue: AnalysisReport = {
      ...baseReport,
      issues: [{ ruleId: 'block-too-long', severity: 'warning', message: 'Block is long', blockId: 'block-1' }],
    };
    expect(renderLintText(reportWithIssue, cleanResult)).toContain('Analysis warnings (1)');
  });

  it('shows analysis issue message in its own section', () => {
    const reportWithIssue: AnalysisReport = {
      ...baseReport,
      issues: [{ ruleId: 'block-too-long', severity: 'warning', message: 'Block is long' }],
    };
    const out = renderLintText(reportWithIssue, cleanResult);
    const analysisIdx = out.indexOf('Analysis warnings');
    const lintIdx = out.indexOf('Lint issues');
    const msgIdx = out.indexOf('Block is long');
    // message appears between the two section headers
    expect(msgIdx).toBeGreaterThan(analysisIdx);
    expect(msgIdx).toBeLessThan(lintIdx);
  });
});

describe('renderLintText — Lint issues section', () => {
  it('shows "Lint issues (0)" when no lint issues', () => {
    expect(renderLintText(baseReport, cleanResult)).toContain('Lint issues (0)');
  });

  it('shows ✓ none when no lint issues', () => {
    expect(renderLintText(baseReport, cleanResult)).toContain('✓ none');
  });

  it('shows count when lint issues exist', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('Lint issues (2)');
  });

  it('shows error icon for lint errors', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('✗');
  });

  it('shows warning icon for lint warnings', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('!');
  });

  it('shows block id in lint section', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('[block-2]');
  });

  it('shows lint issue message', () => {
    expect(renderLintText(baseReport, issueResult)).toContain('Exact duplicate of block-1');
  });

  it('sorts errors before warnings within lint section', () => {
    const out = renderLintText(baseReport, issueResult);
    const lintIdx = out.indexOf('Lint issues');
    const errorPos = out.indexOf('✗', lintIdx);
    const warnPos = out.indexOf('!', lintIdx);
    expect(errorPos).toBeLessThan(warnPos);
  });

  it('renders suggestion when present', () => {
    const withSuggestion: LintResult = {
      issues: [{ ruleId: 'test', severity: 'warning', message: 'Problem here', suggestion: 'Try this fix' }],
      rulesRun: ['test'],
    };
    expect(renderLintText(baseReport, withSuggestion)).toContain('→ Try this fix');
  });
});

describe('renderLintText — sections are independent', () => {
  it('does not mix analysis and lint issues', () => {
    const reportWithIssue: AnalysisReport = {
      ...baseReport,
      issues: [{ ruleId: 'analysis-rule', severity: 'info', message: 'analysis msg' }],
    };
    const out = renderLintText(reportWithIssue, issueResult);
    const analysisIdx = out.indexOf('Analysis warnings');
    const lintIdx = out.indexOf('Lint issues');
    // analysis rule appears before lint section header
    expect(out.indexOf('analysis msg')).toBeGreaterThan(analysisIdx);
    expect(out.indexOf('analysis msg')).toBeLessThan(lintIdx);
    // lint issue message appears after lint section header
    expect(out.indexOf('Exact duplicate')).toBeGreaterThan(lintIdx);
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

  it('has separate analysisIssues and lintIssues arrays', () => {
    const parsed = JSON.parse(renderLintJson(baseReport, issueResult)) as {
      analysisIssues: unknown[];
      lintIssues: unknown[];
    };
    expect(Array.isArray(parsed.analysisIssues)).toBe(true);
    expect(Array.isArray(parsed.lintIssues)).toBe(true);
  });

  it('does not include a merged allIssues field', () => {
    const parsed = JSON.parse(renderLintJson(baseReport, issueResult)) as Record<string, unknown>;
    expect(parsed['allIssues']).toBeUndefined();
  });

  it('lintIssues contains only lint issues', () => {
    const parsed = JSON.parse(renderLintJson(baseReport, issueResult)) as {
      lintIssues: Array<{ ruleId: string }>;
    };
    expect(parsed.lintIssues).toHaveLength(2);
    expect(parsed.lintIssues.every(i => ['duplicated-instruction', 'noisy-tool-output'].includes(i.ruleId))).toBe(true);
  });

  it('includes tokenizer metadata when present', () => {
    const parsed = JSON.parse(
      renderLintJson({ ...baseReport, tokenizer: { id: 'o200k_base' } }, cleanResult),
    ) as { tokenizer: { id: string } };
    expect(parsed.tokenizer.id).toBe('o200k_base');
  });
});
