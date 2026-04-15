import { describe, it, expect } from 'vitest';
import { truncateToolOutput, TOOL_OUTPUT_TOKEN_THRESHOLD } from './truncate-tool-output.js';
import type { ITokenizer, AnalyzedBlock } from '../types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

function lines(n: number, prefix = 'line'): string {
  return Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join('\n');
}

function toolBlock(id: string, content: string): AnalyzedBlock {
  return { id, content, type: 'tool_output', tokenCount: tok.count(content), tokenPercent: 0 };
}

function protectedToolBlock(id: string, content: string): AnalyzedBlock {
  return { ...toolBlock(id, content), metadata: { protected: true } };
}

/** Build a block whose tokenCount exceeds the threshold. */
function bigToolBlock(id: string, lineCount = 60): AnalyzedBlock {
  // Each word-line has 2 tokens; 60 lines → 120 tokens > TOOL_OUTPUT_TOKEN_THRESHOLD if threshold is low.
  // Use many unique words to exceed 300 tokens.
  const content = Array.from({ length: lineCount }, (_, i) =>
    `token_a_${i} token_b_${i} token_c_${i} token_d_${i} token_e_${i} token_f_${i}`,
  ).join('\n');
  return { id, content, type: 'tool_output', tokenCount: tok.count(content), tokenPercent: 0 };
}

describe('truncate-tool-output', () => {
  it('leaves non-tool_output blocks untouched', () => {
    const block: AnalyzedBlock = {
      id: 'b1',
      content: lines(60),
      type: 'instruction',
      tokenCount: 1000,
      tokenPercent: 100,
    };
    const { blocks: out, changes } = truncateToolOutput.apply({ blocks: [block], totalTokens: 1000, tokenizer: tok });
    expect(out[0]?.content).toBe(block.content);
    expect(changes).toHaveLength(0);
  });

  it('leaves tool_output blocks under threshold untouched', () => {
    const content = 'short output here';
    const block = toolBlock('b1', content);
    expect(block.tokenCount).toBeLessThanOrEqual(TOOL_OUTPUT_TOKEN_THRESHOLD);
    const { blocks: out, changes } = truncateToolOutput.apply({ blocks: [block], totalTokens: block.tokenCount, tokenizer: tok });
    expect(out[0]?.content).toBe(content);
    expect(changes).toHaveLength(0);
  });

  it('truncates tool_output blocks over threshold', () => {
    const big = bigToolBlock('b1');
    expect(big.tokenCount).toBeGreaterThan(TOOL_OUTPUT_TOKEN_THRESHOLD);
    const { blocks: out, changes } = truncateToolOutput.apply({ blocks: [big], totalTokens: big.tokenCount, tokenizer: tok });
    expect(out[0]?.content.length).toBeLessThan(big.content.length);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.type).toBe('replace');
  });

  it('inserts truncation marker', () => {
    const big = bigToolBlock('b1');
    const { blocks: out } = truncateToolOutput.apply({ blocks: [big], totalTokens: big.tokenCount, tokenizer: tok });
    expect(out[0]?.content).toContain('[... truncated');
  });

  it('preserves important lines from truncated middle', () => {
    const contentLines = Array.from({ length: 60 }, (_, i) => {
      // Put an error line in the middle
      if (i === 30) return `token_a_${i} token_b_${i} token_c_${i} Error: connection refused token_d_${i} token_e_${i}`;
      return `token_a_${i} token_b_${i} token_c_${i} token_d_${i} token_e_${i} token_f_${i}`;
    });
    const content = contentLines.join('\n');
    const block: AnalyzedBlock = { id: 'b1', content, type: 'tool_output', tokenCount: tok.count(content), tokenPercent: 0 };
    const { blocks: out } = truncateToolOutput.apply({ blocks: [block], totalTokens: block.tokenCount, tokenizer: tok });
    expect(out[0]?.content).toContain('Error: connection refused');
  });

  it('does not mutate the input block', () => {
    const big = bigToolBlock('b1');
    const origContent = big.content;
    truncateToolOutput.apply({ blocks: [big], totalTokens: big.tokenCount, tokenizer: tok });
    expect(big.content).toBe(origContent);
  });

  it('tokenDelta is negative after truncation', () => {
    const big = bigToolBlock('b1');
    const { changes } = truncateToolOutput.apply({ blocks: [big], totalTokens: big.tokenCount, tokenizer: tok });
    expect(changes[0]?.tokenDelta).toBeLessThan(0);
  });

  it('change includes blockIds and reason', () => {
    const big = bigToolBlock('b1');
    const { changes } = truncateToolOutput.apply({ blocks: [big], totalTokens: big.tokenCount, tokenizer: tok });
    expect(changes[0]?.blockIds).toEqual(['b1']);
    expect(changes[0]?.reason).toContain('tool_output exceeded');
  });

  it('does not replace when preserving important lines would not reduce tokens', () => {
    const content = Array.from(
      { length: 60 },
      (_, i) => `Error: failed exception warning token_a_${i} token_b_${i}`,
    ).join('\n');
    const block: AnalyzedBlock = {
      id: 'b1',
      content,
      type: 'tool_output',
      tokenCount: tok.count(content),
      tokenPercent: 0,
    };
    const { blocks: out, changes } = truncateToolOutput.apply({
      blocks: [block],
      totalTokens: block.tokenCount,
      tokenizer: tok,
    });
    expect(out[0]?.content).toBe(content);
    expect(changes).toHaveLength(0);
  });

  it('does not re-truncate a block that already has a truncation marker', () => {
    const content = [
      '```bash',
      ...Array.from({ length: 20 }, (_, i) => `line ${i} alpha beta gamma delta epsilon zeta eta theta`),
      '[... truncated 15 lines ...]',
      'warning: cache miss',
      'error: failed build',
      ...Array.from({ length: 20 }, (_, i) => `tail ${i} alpha beta gamma delta epsilon zeta eta theta`),
      '```',
    ].join('\n');
    const block: AnalyzedBlock = {
      id: 'b1',
      content,
      type: 'tool_output',
      tokenCount: tok.count(content),
      tokenPercent: 0,
    };
    expect(block.tokenCount).toBeGreaterThan(TOOL_OUTPUT_TOKEN_THRESHOLD);
    const { blocks: out, changes } = truncateToolOutput.apply({
      blocks: [block],
      totalTokens: block.tokenCount,
      tokenizer: tok,
    });
    expect(out[0]?.content).toBe(content);
    expect(changes).toHaveLength(0);
  });

  it('does not truncate protected tool output', () => {
    const big = protectedToolBlock('b1', bigToolBlock('b1').content);
    expect(big.tokenCount).toBeGreaterThan(TOOL_OUTPUT_TOKEN_THRESHOLD);
    const { blocks: out, changes } = truncateToolOutput.apply({
      blocks: [big],
      totalTokens: big.tokenCount,
      tokenizer: tok,
    });
    expect(out[0]?.content).toBe(big.content);
    expect(changes).toHaveLength(0);
  });
});
