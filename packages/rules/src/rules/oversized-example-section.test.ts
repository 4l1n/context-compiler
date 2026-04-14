import { describe, it, expect } from 'vitest';
import { oversizedExampleSection, EXAMPLE_RATIO_THRESHOLD } from './oversized-example-section.js';
import type { LintContext } from '../types.js';
import type { AnalyzedBlock } from '@context-compiler/core';

function exBlock(id: string, tokenCount: number): AnalyzedBlock {
  return { id, content: 'x'.repeat(tokenCount * 4), type: 'example', tokenCount, tokenPercent: 0 };
}

function instBlock(id: string, tokenCount: number): AnalyzedBlock {
  return { id, content: 'x'.repeat(tokenCount * 4), type: 'instruction', tokenCount, tokenPercent: 0 };
}

function ctx(blocks: AnalyzedBlock[], totalTokens: number): LintContext {
  return { path: 'test.md', blocks, totalTokens };
}

describe('oversizedExampleSection — triggers warning', () => {
  it('warns when example ratio exceeds threshold', () => {
    // 50 example tokens out of 100 total = 50% > 40%
    const blocks = [exBlock('b1', 50), instBlock('b2', 50)];
    const issues = oversizedExampleSection.check(ctx(blocks, 100));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.message).toContain('50%');
    expect(issues[0]?.message).toContain('50/100');
  });

  it('mentions affected block ids', () => {
    const blocks = [exBlock('ex-1', 30), exBlock('ex-2', 20), instBlock('inst-1', 50)];
    const issues = oversizedExampleSection.check(ctx(blocks, 100));
    expect(issues[0]?.message).toContain('ex-1');
    expect(issues[0]?.message).toContain('ex-2');
  });

  it('mentions the threshold percentage', () => {
    const blocks = [exBlock('b1', 50), instBlock('b2', 50)];
    const issues = oversizedExampleSection.check(ctx(blocks, 100));
    expect(issues[0]?.message).toContain(`${Math.round(EXAMPLE_RATIO_THRESHOLD * 100)}%`);
  });
});

describe('oversizedExampleSection — no issue', () => {
  it('no issue when examples are below threshold', () => {
    // 30 example tokens out of 100 = 30% < 40%
    const blocks = [exBlock('b1', 30), instBlock('b2', 70)];
    expect(oversizedExampleSection.check(ctx(blocks, 100))).toHaveLength(0);
  });

  it('no issue when exactly at threshold', () => {
    const threshold = Math.round(EXAMPLE_RATIO_THRESHOLD * 100);
    const blocks = [exBlock('b1', threshold), instBlock('b2', 100 - threshold)];
    expect(oversizedExampleSection.check(ctx(blocks, 100))).toHaveLength(0);
  });

  it('no issue when no example blocks', () => {
    const blocks = [instBlock('b1', 100)];
    expect(oversizedExampleSection.check(ctx(blocks, 100))).toHaveLength(0);
  });

  it('no issue when totalTokens is 0', () => {
    expect(oversizedExampleSection.check(ctx([], 0))).toHaveLength(0);
  });
});
