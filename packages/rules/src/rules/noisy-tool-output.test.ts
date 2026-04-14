import { describe, it, expect } from 'vitest';
import { noisyToolOutput, TOOL_OUTPUT_TOKEN_THRESHOLD } from './noisy-tool-output.js';
import type { LintContext } from '../types.js';
import type { AnalyzedBlock } from '@context-compiler/core';

function toolBlock(id: string, tokenCount: number): AnalyzedBlock {
  return { id, content: 'x'.repeat(tokenCount * 4), type: 'tool_output', tokenCount, tokenPercent: 0 };
}

function otherBlock(id: string, tokenCount: number): AnalyzedBlock {
  return { id, content: 'x'.repeat(tokenCount * 4), type: 'instruction', tokenCount, tokenPercent: 0 };
}

function ctx(blocks: AnalyzedBlock[]): LintContext {
  return { path: 'test.md', blocks, totalTokens: 1000 };
}

describe('noisyToolOutput — triggers warning', () => {
  it('warns when tool_output exceeds threshold', () => {
    const issues = noisyToolOutput.check(ctx([toolBlock('b1', TOOL_OUTPUT_TOKEN_THRESHOLD + 1)]));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.blockId).toBe('b1');
  });

  it('includes token count and threshold in message', () => {
    const count = TOOL_OUTPUT_TOKEN_THRESHOLD + 50;
    const issues = noisyToolOutput.check(ctx([toolBlock('b1', count)]));
    expect(issues[0]?.message).toContain(String(count));
    expect(issues[0]?.message).toContain(String(TOOL_OUTPUT_TOKEN_THRESHOLD));
  });

  it('emits one issue per oversized tool_output block', () => {
    const blocks = [
      toolBlock('b1', TOOL_OUTPUT_TOKEN_THRESHOLD + 10),
      toolBlock('b2', TOOL_OUTPUT_TOKEN_THRESHOLD + 20),
    ];
    expect(noisyToolOutput.check(ctx(blocks))).toHaveLength(2);
  });
});

describe('noisyToolOutput — no issue', () => {
  it('no issue when tool_output is at threshold', () => {
    expect(noisyToolOutput.check(ctx([toolBlock('b1', TOOL_OUTPUT_TOKEN_THRESHOLD)]))).toHaveLength(0);
  });

  it('no issue when tool_output is below threshold', () => {
    expect(noisyToolOutput.check(ctx([toolBlock('b1', TOOL_OUTPUT_TOKEN_THRESHOLD - 1)]))).toHaveLength(0);
  });

  it('no issue when no tool_output blocks', () => {
    expect(noisyToolOutput.check(ctx([otherBlock('b1', 500)]))).toHaveLength(0);
  });

  it('no issue for empty context', () => {
    expect(noisyToolOutput.check(ctx([]))).toHaveLength(0);
  });
});
