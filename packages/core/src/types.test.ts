import { describe, it, expect } from 'vitest';
import type { PromptBlock, AnalysisReport, OptimizationChange } from './types.js';

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

describe('AnalysisReport', () => {
  it('accepts empty report', () => {
    const report: AnalysisReport = {
      blocks: [],
      issues: [],
      tokenCount: 0,
      createdAt: new Date(),
    };
    expect(report.issues).toHaveLength(0);
    expect(report.tokenCount).toBe(0);
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
