import { describe, it, expect } from 'vitest';
import { removeExactDuplicates } from './remove-exact-duplicates.js';
import type { ITokenizer, AnalyzedBlock } from '../types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

function block(id: string, content: string): AnalyzedBlock {
  return { id, content, type: 'instruction', tokenCount: tok.count(content), tokenPercent: 0 };
}

describe('remove-exact-duplicates', () => {
  it('returns all blocks unchanged when no duplicates', () => {
    const blocks = [block('b1', 'Hello'), block('b2', 'World')];
    const { blocks: out, changes } = removeExactDuplicates.apply({ blocks, totalTokens: 2, tokenizer: tok });
    expect(out).toHaveLength(2);
    expect(changes).toHaveLength(0);
  });

  it('removes second exact-duplicate block', () => {
    const blocks = [block('b1', 'You are an assistant.'), block('b2', 'You are an assistant.')];
    const { blocks: out, changes } = removeExactDuplicates.apply({ blocks, totalTokens: 8, tokenizer: tok });
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('b1');
    expect(changes).toHaveLength(1);
    expect(changes[0]?.type).toBe('remove');
    expect(changes[0]?.blockIds).toEqual(['b1', 'b2']);
    expect(changes[0]?.primaryBlockId).toBe('b2');
  });

  it('keeps first occurrence, removes all subsequent', () => {
    const content = 'Duplicate content';
    const blocks = [block('b1', content), block('b2', content), block('b3', content)];
    const { blocks: out, changes } = removeExactDuplicates.apply({ blocks, totalTokens: 6, tokenizer: tok });
    expect(out).toHaveLength(1);
    expect(changes).toHaveLength(2);
  });

  it('handles whitespace normalisation — trims before comparing', () => {
    const blocks = [block('b1', 'Hello'), block('b2', '  Hello  ')];
    const { blocks: out } = removeExactDuplicates.apply({ blocks, totalTokens: 2, tokenizer: tok });
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('b1');
  });

  it('does not remove blocks that differ by a single char', () => {
    const blocks = [block('b1', 'Hello.'), block('b2', 'Hello!')];
    const { blocks: out, changes } = removeExactDuplicates.apply({ blocks, totalTokens: 2, tokenizer: tok });
    expect(out).toHaveLength(2);
    expect(changes).toHaveLength(0);
  });

  it('does not mutate the input array', () => {
    const blocks = [block('b1', 'A'), block('b2', 'A')];
    const original = [...blocks];
    removeExactDuplicates.apply({ blocks, totalTokens: 2, tokenizer: tok });
    expect(blocks).toEqual(original);
  });

  it('tokenDelta is negative (removal reduces tokens)', () => {
    const blocks = [block('b1', 'You are an assistant.'), block('b2', 'You are an assistant.')];
    const { changes } = removeExactDuplicates.apply({ blocks, totalTokens: 8, tokenizer: tok });
    expect(changes[0]?.tokenDelta).toBeLessThan(0);
  });

  it('operates at block level — does not collapse partial line matches', () => {
    const blocks = [
      block('b1', 'You are an assistant.\nBe concise.'),
      block('b2', 'Be concise.'),  // same as a line in b1, but different full content
    ];
    const { blocks: out } = removeExactDuplicates.apply({ blocks, totalTokens: 6, tokenizer: tok });
    // b2 is NOT removed — its content as a whole block differs from b1
    expect(out).toHaveLength(2);
  });
});
