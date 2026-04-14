import { describe, it, expect } from 'vitest';
import { buildTransforms, KNOWN_TRANSFORM_IDS } from './index.js';
import type { AnalyzedBlock, ITokenizer } from '../types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

function toolOutputBlock(id: string, lineCount: number): AnalyzedBlock {
  const content = Array.from(
    { length: lineCount },
    (_, i) => `line_${i} alpha beta gamma delta epsilon zeta eta theta iota`,
  ).join('\n');
  return {
    id,
    content,
    type: 'tool_output',
    tokenCount: tok.count(content),
    tokenPercent: 100,
  };
}

describe('buildTransforms', () => {
  it('returns default transform order when no filters are provided', () => {
    const transforms = buildTransforms();
    expect(transforms.map(t => t.id)).toEqual(KNOWN_TRANSFORM_IDS);
    expect(transforms.map(t => t.id)).toEqual([
      'remove-exact-duplicates',
      'collapse-formatting-rules',
      'truncate-tool-output',
      'trim-oversized-examples',
    ]);
  });

  it('supports enabled transform id filters', () => {
    const transforms = buildTransforms({
      enabledTransformIds: ['truncate-tool-output'],
    });
    expect(transforms.map(t => t.id)).toEqual(['truncate-tool-output']);
  });

  it('supports disabled transform id filters', () => {
    const transforms = buildTransforms({
      disabledTransformIds: ['collapse-formatting-rules', 'trim-oversized-examples'],
    });
    expect(transforms.map(t => t.id)).toEqual([
      'remove-exact-duplicates',
      'truncate-tool-output',
    ]);
  });

  it('uses custom threshold for truncate-tool-output', () => {
    const transforms = buildTransforms({
      enabledTransformIds: ['truncate-tool-output'],
      thresholds: { truncateToolOutputTokens: 1000 },
    });
    const transform = transforms[0];
    expect(transform?.id).toBe('truncate-tool-output');

    const block = toolOutputBlock('b1', 40);
    const result = transform?.apply({
      blocks: [block],
      totalTokens: block.tokenCount,
      tokenizer: tok,
    });
    expect(result?.changes).toHaveLength(0);
  });

  it('throws on unknown enabled transform ids', () => {
    expect(() =>
      buildTransforms({
        enabledTransformIds: ['missing-transform'],
      }),
    ).toThrow('Unknown optimize transform id in enabledTransformIds: missing-transform');
  });

  it('throws on unknown disabled transform ids', () => {
    expect(() =>
      buildTransforms({
        disabledTransformIds: ['missing-transform'],
      }),
    ).toThrow('Unknown optimize transform id in disabledTransformIds: missing-transform');
  });
});
