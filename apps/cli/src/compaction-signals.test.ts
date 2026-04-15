import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '@context-compiler/core';
import { hasDirectCompactionSignal } from './compaction-signals.js';

const baseReport: AnalysisReport = {
  path: '<text>',
  blocks: [],
  issues: [],
  totalBlocks: 0,
  totalTokens: 0,
  createdAt: new Date('2024-01-01'),
};

describe('hasDirectCompactionSignal', () => {
  it('returns true for exact duplicate non-protected blocks', () => {
    const report: AnalysisReport = {
      ...baseReport,
      blocks: [
        { id: 'block-1', content: 'Same', type: 'instruction', tokenCount: 1, tokenPercent: 50 },
        { id: 'block-2', content: 'Same', type: 'constraint', tokenCount: 1, tokenPercent: 50 },
      ],
    };
    expect(hasDirectCompactionSignal(report)).toBe(true);
  });

  it('returns true for exact consecutive repeated sentence signal', () => {
    const report: AnalysisReport = {
      ...baseReport,
      blocks: [
        {
          id: 'block-1',
          content: 'You are helpful. You are helpful.',
          type: 'instruction',
          tokenCount: 6,
          tokenPercent: 100,
        },
      ],
    };
    expect(hasDirectCompactionSignal(report)).toBe(true);
  });

  it('returns false for weak/indirect signals only', () => {
    const report: AnalysisReport = {
      ...baseReport,
      blocks: [
        {
          id: 'block-1',
          content: 'Be concise.',
          type: 'unknown',
          tokenCount: 2,
          tokenPercent: 100,
        },
      ],
      issues: [{ ruleId: 'too-many-unknown-blocks', severity: 'info', message: 'x' }],
    };
    expect(hasDirectCompactionSignal(report)).toBe(false);
  });
});
