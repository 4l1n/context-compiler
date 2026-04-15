import { describe, it, expect } from 'vitest';
import { collapseRepeatedSentences } from './collapse-repeated-sentences.js';
import type { AnalyzedBlock, ITokenizer } from '../types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

function block(
  id: string,
  content: string,
  type: AnalyzedBlock['type'] = 'instruction',
): AnalyzedBlock {
  return {
    id,
    content,
    type,
    tokenCount: tok.count(content),
    tokenPercent: 0,
  };
}

describe('collapse-repeated-sentences', () => {
  it('collapses exact consecutive repeated sentences inside a block', () => {
    const input = block('b1', 'You are helpful. You are helpful.');
    const { blocks, changes } = collapseRepeatedSentences.apply({
      blocks: [input],
      totalTokens: input.tokenCount,
      tokenizer: tok,
    });

    expect(blocks[0]?.content).toBe('You are helpful.');
    expect(changes).toHaveLength(1);
    expect(changes[0]?.transformId).toBe('collapse-repeated-sentences');
    expect(changes[0]?.tokenDelta).toBeLessThan(0);
  });

  it('preserves punctuation while collapsing repeats', () => {
    const input = block('b1', 'Be concise! Be concise!');
    const { blocks } = collapseRepeatedSentences.apply({
      blocks: [input],
      totalTokens: input.tokenCount,
      tokenizer: tok,
    });

    expect(blocks[0]?.content).toBe('Be concise!');
  });

  it('does not collapse non-consecutive repeats', () => {
    const input = block('b1', 'A. B. A.');
    const { blocks, changes } = collapseRepeatedSentences.apply({
      blocks: [input],
      totalTokens: input.tokenCount,
      tokenizer: tok,
    });

    expect(blocks[0]?.content).toBe('A. B. A.');
    expect(changes).toHaveLength(0);
  });

  it('no-ops for ambiguous sentence segmentation', () => {
    const input = block('b1', 'You are helpful... You are helpful...');
    const { blocks, changes } = collapseRepeatedSentences.apply({
      blocks: [input],
      totalTokens: input.tokenCount,
      tokenizer: tok,
    });

    expect(blocks[0]?.content).toBe(input.content);
    expect(changes).toHaveLength(0);
  });

  it('no-ops for protected blocks', () => {
    const input: AnalyzedBlock = {
      ...block('b1', 'You are helpful. You are helpful.'),
      metadata: { protected: true },
    };

    const { blocks, changes } = collapseRepeatedSentences.apply({
      blocks: [input],
      totalTokens: input.tokenCount,
      tokenizer: tok,
    });

    expect(blocks[0]?.content).toBe(input.content);
    expect(changes).toHaveLength(0);
  });

  it('no-ops for structured_data and tool_output blocks', () => {
    const structured = block('b1', 'You are helpful. You are helpful.', 'structured_data');
    const tool = block('b2', 'You are helpful. You are helpful.', 'tool_output');

    const { blocks, changes } = collapseRepeatedSentences.apply({
      blocks: [structured, tool],
      totalTokens: structured.tokenCount + tool.tokenCount,
      tokenizer: tok,
    });

    expect(blocks[0]?.content).toBe(structured.content);
    expect(blocks[1]?.content).toBe(tool.content);
    expect(changes).toHaveLength(0);
  });
});
