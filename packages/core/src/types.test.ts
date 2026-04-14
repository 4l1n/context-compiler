import { describe, it, expect } from 'vitest';
import type { PromptBlock, AnalysisReport, OptimizationChange, AnalyzedBlock } from './types.js';

describe('PromptBlock', () => {
  it('accepts valid block', () => {
    const block: PromptBlock = {
      id: 'block-1',
      role: 'system',
      content: 'You are a helpful assistant.',
    };
    expect(block.id).toBe('block-1');
    expect(block.role).toBe('system');
  });

  it('accepts optional metadata', () => {
    const block: PromptBlock = {
      id: 'block-2',
      role: 'user',
      content: 'Hello',
      metadata: { source: 'test' },
    };
    expect(block.metadata?.['source']).toBe('test');
  });
});

describe('AnalyzedBlock', () => {
  it('accepts valid analyzed block', () => {
    const block: AnalyzedBlock = {
      id: 'block-1',
      content: 'You are an assistant.',
      type: 'instruction',
      tokenCount: 5,
      tokenPercent: 100,
    };
    expect(block.type).toBe('instruction');
    expect(block.tokenCount).toBe(5);
  });
});

describe('AnalysisReport', () => {
  it('accepts empty report', () => {
    const report: AnalysisReport = {
      path: '/tmp/test.md',
      blocks: [],
      issues: [],
      totalBlocks: 0,
      totalTokens: 0,
      createdAt: new Date(),
    };
    expect(report.issues).toHaveLength(0);
    expect(report.totalTokens).toBe(0);
    expect(report.path).toBe('/tmp/test.md');
  });
});

describe('OptimizationChange', () => {
  it('accepts remove change without after', () => {
    const change: OptimizationChange = {
      type: 'remove',
      blockId: 'block-1',
      before: 'redundant text',
      reason: 'duplicate content',
      tokenDelta: -5,
    };
    expect(change.type).toBe('remove');
    expect(change.tokenDelta).toBeLessThan(0);
  });
});
