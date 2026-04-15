import { describe, it, expect } from 'vitest';
import { renderText, renderJson } from './render.js';
import type { AnalysisReport } from '@context-compiler/core';

const baseReport: AnalysisReport = {
  path: '/tmp/prompt.md',
  blocks: [
    {
      id: 'block-1',
      content: 'You are a helpful assistant.',
      type: 'instruction',
      tokenCount: 7,
      tokenPercent: 70,
    },
    {
      id: 'block-2',
      content: 'Do not lie.',
      type: 'constraint',
      tokenCount: 3,
      tokenPercent: 30,
    },
  ],
  issues: [],
  totalBlocks: 2,
  totalTokens: 10,
  createdAt: new Date('2024-01-01'),
};

describe('renderText', () => {
  it('includes the file path', () => {
    const output = renderText(baseReport);
    expect(output).toContain('/tmp/prompt.md');
  });

  it('shows total token count', () => {
    const output = renderText(baseReport);
    expect(output).toContain('10');
  });

  it('shows tokenizer metadata when present', () => {
    const output = renderText({ ...baseReport, tokenizer: { id: 'o200k_base' } });
    expect(output).toContain('Tokenizer: o200k_base');
  });

  it('shows total block count', () => {
    const output = renderText(baseReport);
    expect(output).toContain('2');
  });

  it('shows block type and id', () => {
    const output = renderText(baseReport);
    expect(output).toContain('instruction');
    expect(output).toContain('block-1');
  });

  it('marks protected blocks', () => {
    const output = renderText({
      ...baseReport,
      blocks: [
        {
          ...baseReport.blocks[0]!,
          metadata: { protected: true },
        },
      ],
      totalBlocks: 1,
    });
    expect(output).toContain('protected');
  });

  it('shows content preview', () => {
    const output = renderText(baseReport);
    expect(output).toContain('You are a helpful assistant');
  });

  it('omits warnings section when no issues', () => {
    const output = renderText(baseReport);
    expect(output).not.toContain('Warnings');
  });

  it('shows warnings section when issues exist', () => {
    const reportWithIssue: AnalysisReport = {
      ...baseReport,
      issues: [
        {
          ruleId: 'block-too-long',
          severity: 'warning',
          message: 'Block is 600 tokens',
          blockId: 'block-1',
        },
      ],
    };
    const output = renderText(reportWithIssue);
    expect(output).toContain('Warnings');
    expect(output).toContain('block-too-long');
    expect(output).toContain('Block is 600 tokens');
    expect(output).toContain('[block-1]');
  });

  it('shows ruleId on first line and message on second line', () => {
    const reportWithIssue: AnalysisReport = {
      ...baseReport,
      issues: [{ ruleId: 'block-too-long', severity: 'warning', message: 'Block is 600 tokens', blockId: 'block-1' }],
    };
    const out = renderText(reportWithIssue);
    const ruleIdx = out.indexOf('block-too-long');
    const msgIdx = out.indexOf('Block is 600 tokens');
    expect(ruleIdx).toBeLessThan(msgIdx);
  });

  it('renders suggestion with → prefix when present', () => {
    const reportWithSuggestion: AnalysisReport = {
      ...baseReport,
      issues: [{ ruleId: 'block-too-long', severity: 'warning', message: 'Block is long', suggestion: 'Trim it' }],
    };
    expect(renderText(reportWithSuggestion)).toContain('→ Trim it');
  });

  it('omits suggestion line when suggestion absent', () => {
    const reportWithIssue: AnalysisReport = {
      ...baseReport,
      issues: [{ ruleId: 'block-too-long', severity: 'warning', message: 'Block is long' }],
    };
    expect(renderText(reportWithIssue)).not.toContain('→');
  });

  it('uses correct severity icons', () => {
    const reportWithIssues: AnalysisReport = {
      ...baseReport,
      issues: [
        { ruleId: 'a', severity: 'error', message: 'err msg' },
        { ruleId: 'b', severity: 'warning', message: 'warn msg' },
        { ruleId: 'c', severity: 'info', message: 'info msg' },
      ],
    };
    const output = renderText(reportWithIssues);
    expect(output).toContain('✗');
    expect(output).toContain('!');
    expect(output).toContain('i');
  });
});

describe('renderJson', () => {
  it('returns valid JSON', () => {
    const output = renderJson(baseReport);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('includes path in output', () => {
    const output = renderJson(baseReport);
    const parsed = JSON.parse(output) as { path: string };
    expect(parsed.path).toBe('/tmp/prompt.md');
  });

  it('includes blocks array', () => {
    const output = renderJson(baseReport);
    const parsed = JSON.parse(output) as { blocks: unknown[] };
    expect(parsed.blocks).toHaveLength(2);
  });

  it('includes tokenizer metadata when present', () => {
    const output = renderJson({ ...baseReport, tokenizer: { id: 'o200k_base' } });
    const parsed = JSON.parse(output) as { tokenizer: { id: string } };
    expect(parsed.tokenizer.id).toBe('o200k_base');
  });
});
