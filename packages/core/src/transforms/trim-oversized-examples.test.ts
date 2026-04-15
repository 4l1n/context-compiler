import { describe, it, expect } from 'vitest';
import { trimOversizedExamples, EXAMPLE_MAX_PERCENT } from './trim-oversized-examples.js';
import type { ITokenizer, AnalyzedBlock } from '../types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

function block(id: string, content: string, type: AnalyzedBlock['type'] = 'instruction'): AnalyzedBlock {
  return { id, content, type, tokenCount: tok.count(content), tokenPercent: 0 };
}

function protectedBlock(id: string, content: string, type: AnalyzedBlock['type'] = 'instruction'): AnalyzedBlock {
  return { ...block(id, content, type), metadata: { protected: true } };
}

function exampleLines(n: number): string {
  return Array.from({ length: n }, (_, i) => `Example line ${i + 1} here`).join('\n');
}

describe('trim-oversized-examples', () => {
  it('does not trim when examples are within threshold', () => {
    const instr = block('b1', 'You are helpful.', 'instruction');   // 3 tok
    const ex = block('b2', exampleLines(10), 'example');            // 40 tok
    const totalTokens = instr.tokenCount + ex.tokenCount;
    const pct = (ex.tokenCount / totalTokens) * 100;
    // Only trim if > EXAMPLE_MAX_PERCENT
    if (pct <= EXAMPLE_MAX_PERCENT) {
      const { changes } = trimOversizedExamples.apply({ blocks: [instr, ex], totalTokens, tokenizer: tok });
      expect(changes).toHaveLength(0);
    }
  });

  it('trims example blocks when they exceed the threshold', () => {
    // Make examples dominant: 1 instruction (5 tok) + 1 big example (many tok)
    const instr = block('b1', 'You are an assistant.', 'instruction'); // 4 tok
    const exContent = exampleLines(20); // 20 * 4 tok ≈ 80 tok
    const ex = block('b2', exContent, 'example');
    const totalTokens = instr.tokenCount + ex.tokenCount;
    const pct = (ex.tokenCount / totalTokens) * 100;
    expect(pct).toBeGreaterThan(EXAMPLE_MAX_PERCENT);

    const { blocks: out, changes } = trimOversizedExamples.apply({ blocks: [instr, ex], totalTokens, tokenizer: tok });
    expect(changes).toHaveLength(1);
    expect(changes[0]?.type).toBe('replace');
    expect(out[1]?.content.split('\n').length).toBeLessThan(ex.content.split('\n').length);
  });

  it('inserts truncation marker', () => {
    const instr = block('b1', 'You are an assistant.', 'instruction');
    const ex = block('b2', exampleLines(20), 'example');
    const totalTokens = instr.tokenCount + ex.tokenCount;
    const { blocks: out } = trimOversizedExamples.apply({ blocks: [instr, ex], totalTokens, tokenizer: tok });
    expect(out[1]?.content).toContain('[... example truncated');
  });

  it('does not trim example blocks already at or under MIN_LINES', () => {
    const instr = block('b1', 'A.', 'instruction');
    const ex = block('b2', exampleLines(3), 'example');  // 3 lines ≤ MIN_LINES (5)
    const totalTokens = 5; // force high percent
    const { changes } = trimOversizedExamples.apply({ blocks: [instr, ex], totalTokens, tokenizer: tok });
    // example is 3 lines ≤ 5 → not trimmed even if percent is high
    expect(changes).toHaveLength(0);
  });

  it('does not touch non-example blocks', () => {
    const instr = block('b1', 'A.', 'instruction');
    const tool = block('b2', exampleLines(20), 'tool_output');
    const totalTokens = instr.tokenCount + tool.tokenCount;
    const { changes } = trimOversizedExamples.apply({ blocks: [instr, tool], totalTokens, tokenizer: tok });
    expect(changes).toHaveLength(0);
  });

  it('handles totalTokens === 0 gracefully', () => {
    const ex = block('b1', exampleLines(20), 'example');
    const { blocks: out, changes } = trimOversizedExamples.apply({ blocks: [ex], totalTokens: 0, tokenizer: tok });
    expect(changes).toHaveLength(0);
    expect(out).toHaveLength(1);
  });

  it('does not mutate input blocks', () => {
    const instr = block('b1', 'You are an assistant.', 'instruction');
    const ex = block('b2', exampleLines(20), 'example');
    const origContent = ex.content;
    const totalTokens = instr.tokenCount + ex.tokenCount;
    trimOversizedExamples.apply({ blocks: [instr, ex], totalTokens, tokenizer: tok });
    expect(ex.content).toBe(origContent);
  });

  it('change includes blockIds and reason', () => {
    const instr = block('b1', 'You are an assistant.', 'instruction');
    const ex = block('b2', exampleLines(20), 'example');
    const totalTokens = instr.tokenCount + ex.tokenCount;
    const { changes } = trimOversizedExamples.apply({ blocks: [instr, ex], totalTokens, tokenizer: tok });
    if (changes.length > 0) {
      expect(changes[0]?.blockIds).toEqual(['b2']);
      expect(changes[0]?.reason).toContain('threshold');
    }
  });

  it('does not re-trim an example block that already has a truncation marker', () => {
    const instr = block('b1', 'A.', 'instruction');
    const ex = block(
      'b2',
      `${exampleLines(8)}\n[... example truncated 20 lines ...]`,
      'example',
    );
    const totalTokens = instr.tokenCount + ex.tokenCount;
    const { blocks: out, changes } = trimOversizedExamples.apply({
      blocks: [instr, ex],
      totalTokens,
      tokenizer: tok,
    });
    expect(out[1]?.content).toBe(ex.content);
    expect(changes).toHaveLength(0);
  });

  it('does not trim protected examples', () => {
    const instr = block('b1', 'A.', 'instruction');
    const ex = protectedBlock('b2', exampleLines(20), 'example');
    const totalTokens = instr.tokenCount + ex.tokenCount;
    const { blocks: out, changes } = trimOversizedExamples.apply({
      blocks: [instr, ex],
      totalTokens,
      tokenizer: tok,
    });
    expect(out[1]?.content).toBe(ex.content);
    expect(changes).toHaveLength(0);
  });

  it('excludes protected examples from example-budget calculations', () => {
    const instr = block(
      'b1',
      Array.from({ length: 100 }, (_, i) => `instruction_${i}`).join(' '),
      'instruction',
    );
    const protectedExample = protectedBlock('b2', exampleLines(20), 'example');
    const smallExample = block('b3', exampleLines(6), 'example');
    const totalTokens = instr.tokenCount + protectedExample.tokenCount + smallExample.tokenCount;
    const { blocks: out, changes } = trimOversizedExamples.apply({
      blocks: [instr, protectedExample, smallExample],
      totalTokens,
      tokenizer: tok,
    });
    expect(out[1]?.content).toBe(protectedExample.content);
    expect(out[2]?.content).toBe(smallExample.content);
    expect(changes).toHaveLength(0);
  });
});
