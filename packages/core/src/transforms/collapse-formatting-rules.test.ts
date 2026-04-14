import { describe, it, expect } from 'vitest';
import { collapseFormattingRules } from './collapse-formatting-rules.js';
import type { ITokenizer, AnalyzedBlock, BlockType } from '../types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

function block(id: string, content: string, type: BlockType = 'instruction'): AnalyzedBlock {
  return { id, content, type, tokenCount: tok.count(content), tokenPercent: 0 };
}

describe('collapse-formatting-rules', () => {
  it('returns blocks unchanged when no formatting directive is repeated', () => {
    const blocks = [block('b1', 'You are helpful.'), block('b2', 'Do not lie.')];
    const { blocks: out, changes } = collapseFormattingRules.apply({ blocks, totalTokens: 8, tokenizer: tok });
    expect(out).toHaveLength(2);
    expect(changes).toHaveLength(0);
  });

  it('removes duplicate formatting directive line from second block', () => {
    const b1 = block('b1', 'You are an assistant.\nBe concise.');
    const b2 = block('b2', 'Follow these rules.\nBe concise.\nAvoid jargon.');
    const { blocks: out, changes } = collapseFormattingRules.apply({
      blocks: [b1, b2],
      totalTokens: 20,
      tokenizer: tok,
    });
    expect(out[1]?.content).not.toContain('Be concise');
    expect(out[1]?.content).toContain('Avoid jargon');
    expect(changes).toHaveLength(1);
    expect(changes[0]?.type).toBe('replace');
    expect(changes[0]?.blockIds).toEqual(['b2']);
    expect(changes[0]?.before).toContain('Be concise');
    expect(changes[0]?.after).not.toContain('Be concise');
  });

  it('only applies to instruction, constraint, memory blocks', () => {
    const directive = 'Be concise.';
    const instr = block('b1', directive, 'instruction');
    const example = block('b2', directive, 'example');
    const toolOut = block('b3', directive, 'tool_output');
    const structured = block('b4', directive, 'structured_data');
    const { blocks: out, changes } = collapseFormattingRules.apply({
      blocks: [instr, example, toolOut, structured],
      totalTokens: 8,
      tokenizer: tok,
    });
    // example, tool_output, structured_data must remain untouched
    expect(out[1]?.content).toBe(directive);
    expect(out[2]?.content).toBe(directive);
    expect(out[3]?.content).toBe(directive);
    expect(changes).toHaveLength(0); // no change — only b1 was instruction, first occurrence
  });

  it('applies to constraint blocks', () => {
    const b1 = block('b1', 'Be concise.', 'constraint');
    const b2 = block('b2', 'Be concise.\nAlways respond in English.', 'constraint');
    const { blocks: out, changes } = collapseFormattingRules.apply({
      blocks: [b1, b2],
      totalTokens: 10,
      tokenizer: tok,
    });
    expect(changes).toHaveLength(1);
    expect(out[1]?.content).not.toContain('Be concise');
  });

  it('applies to memory blocks', () => {
    const b1 = block('b1', 'Use markdown format.', 'memory');
    const b2 = block('b2', 'Use markdown format.\nRemember the user name.', 'memory');
    const { blocks: out, changes } = collapseFormattingRules.apply({
      blocks: [b1, b2],
      totalTokens: 10,
      tokenizer: tok,
    });
    expect(changes).toHaveLength(1);
    expect(out[1]?.content).not.toContain('markdown format');
  });

  it('does not remove a single-occurrence directive', () => {
    const b1 = block('b1', 'Be concise.');
    const b2 = block('b2', 'Avoid jargon.');
    const { changes } = collapseFormattingRules.apply({ blocks: [b1, b2], totalTokens: 4, tokenizer: tok });
    expect(changes).toHaveLength(0);
  });

  it('does not mutate input blocks', () => {
    const b1 = block('b1', 'Be concise.');
    const b2 = block('b2', 'Be concise.\nOther stuff.');
    const origContent1 = b1.content;
    const origContent2 = b2.content;
    collapseFormattingRules.apply({ blocks: [b1, b2], totalTokens: 10, tokenizer: tok });
    expect(b1.content).toBe(origContent1);
    expect(b2.content).toBe(origContent2);
  });

  it('preserves non-directive lines in the modified block', () => {
    const b1 = block('b1', 'Be concise.');
    const b2 = block('b2', 'You are helpful.\nBe concise.\nDo your best.');
    const { blocks: out } = collapseFormattingRules.apply({
      blocks: [b1, b2],
      totalTokens: 12,
      tokenizer: tok,
    });
    expect(out[1]?.content).toContain('You are helpful');
    expect(out[1]?.content).toContain('Do your best');
  });

  it('does not touch formatting-looking lines inside code fences', () => {
    const b1 = block('b1', 'Be concise.');
    const b2 = block('b2', '```txt\nBe concise.\n```');
    const { blocks: out, changes } = collapseFormattingRules.apply({
      blocks: [b1, b2],
      totalTokens: 10,
      tokenizer: tok,
    });
    expect(out[1]?.content).toBe(b2.content);
    expect(changes).toHaveLength(0);
  });

  it('does not replace a block with empty content', () => {
    const b1 = block('b1', 'Be concise.');
    const b2 = block('b2', 'Be concise.');
    const { blocks: out, changes } = collapseFormattingRules.apply({
      blocks: [b1, b2],
      totalTokens: 4,
      tokenizer: tok,
    });
    expect(out[1]?.content).toBe('Be concise.');
    expect(changes).toHaveLength(0);
  });
});
