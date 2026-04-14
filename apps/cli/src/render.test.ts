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

  it('shows total block count', () => {
    const output = renderText(baseReport);
    expect(output).toContain('2');
  });

  it('shows block type and id', () => {
    const output = renderText(baseReport);
    expect(output).toContain('instruction');
    expect(output).toContain('block-1');
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
    expect(output).toContain('Block is 600 tokens');
    expect(output).toContain('[block-1]');
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
});
