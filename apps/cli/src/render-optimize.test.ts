import { describe, it, expect } from 'vitest';
import { renderOptimizeJson, renderOptimizeText } from './render-optimize.js';
import type { OptimizationResult } from '@context-compiler/core';

const baseResult: OptimizationResult = {
  path: '/tmp/prompt.md',
  originalContent: 'You are helpful.\n\nYou are helpful.',
  optimizedContent: 'You are helpful.',
  originalTokens: 8,
  optimizedTokens: 4,
  tokenSavings: 4,
  appliedChanges: [
    {
      type: 'remove',
      transformId: 'remove-exact-duplicates',
      blockIds: ['block-1', 'block-2'],
      primaryBlockId: 'block-2',
      before: 'You are helpful.',
      reason: 'Exact duplicate of block-1',
      tokenDelta: -4,
    },
  ],
};

describe('renderOptimizeText', () => {
  it('shows path, result line, token counts, and change count', () => {
    const out = renderOptimizeText(baseResult, { dryRun: true });
    expect(out).toContain('/tmp/prompt.md');
    expect(out).toContain('Result:');
    expect(out).toContain('8');
    expect(out).toContain('4');
    expect(out).toContain('Applied transforms:');
  });

  it('shows tokenizer metadata when present', () => {
    const out = renderOptimizeText({ ...baseResult, tokenizer: { id: 'o200k_base' } }, { dryRun: true });
    expect(out).toContain('Tokenizer: o200k_base');
  });

  it('shows active transform filtering when present', () => {
    const out = renderOptimizeText(
      {
        ...baseResult,
        transformSelection: {
          mode: 'only',
          activeTransformIds: ['remove-exact-duplicates'],
          requestedIds: ['remove-exact-duplicates'],
        },
      },
      { dryRun: true },
    );
    expect(out).toContain('Transforms: only remove-exact-duplicates');
  });

  it('shows change reason and before preview', () => {
    const out = renderOptimizeText(baseResult, { dryRun: true });
    expect(out).toContain('remove-exact-duplicates');
    expect(out).toContain('Exact duplicate of block-1');
  });

  it('shows dry-run status when file was not written', () => {
    const out = renderOptimizeText(baseResult, { dryRun: true });
    expect(out).toContain('File not written');
  });

  it('does not suggest --write for non-file input', () => {
    const out = renderOptimizeText(
      { ...baseResult, path: '<text>' },
      { dryRun: true, canWrite: false },
    );
    expect(out).toContain('File not written.');
    expect(out).not.toContain('Use --write');
  });

  it('shows written status after --write succeeds', () => {
    const out = renderOptimizeText(baseResult, { wroteFile: true });
    expect(out).toContain('File written: /tmp/prompt.md');
  });

  it('renders compact diff output', () => {
    const out = renderOptimizeText(baseResult, { dryRun: true, diff: true });
    expect(out).toContain('remove-exact-duplicates [block-1, block-2] (-4 tok)');
    expect(out).toContain('before:');
    expect(out).toContain('after:');
    expect(out).toContain('<removed>');
  });

  it('renders after snippet for replace changes in diff output', () => {
    const out = renderOptimizeText(
      {
        ...baseResult,
        appliedChanges: [
          {
            type: 'replace',
            transformId: 'collapse-formatting-rules',
            blockIds: ['block-1'],
            before: 'Be concise.\nUse markdown.',
            after: 'Use markdown.',
            reason: 'test',
            tokenDelta: -2,
          },
        ],
      },
      { dryRun: true, diff: true },
    );
    expect(out).toContain('collapse-formatting-rules [block-1] (-2 tok)');
    expect(out).toContain('after:  "Use markdown."');
  });

  it('renders no-change result without write status noise', () => {
    const result: OptimizationResult = {
      ...baseResult,
      optimizedContent: baseResult.originalContent,
      optimizedTokens: baseResult.originalTokens,
      tokenSavings: 0,
      appliedChanges: [],
    };
    const out = renderOptimizeText(result, { dryRun: true });
    expect(out).toContain('Result: no deterministic compaction found');
    expect(out).not.toContain('File not written');
  });

  it('renders compact mode title and final compacted text', () => {
    const out = renderOptimizeText(baseResult, {
      command: 'compact',
      dryRun: true,
      showOptimizedContent: true,
    });
    expect(out).toContain('Compact: /tmp/prompt.md');
    expect(out).toContain('Result text:');
    expect(out).toContain('You are helpful.');
    expect(out).toContain('Preview only. File not written.');
  });

  it('keeps ordering: result before tokens before tokenizer before result text', () => {
    const out = renderOptimizeText({ ...baseResult, tokenizer: { id: 'char' } }, {
      command: 'compact',
      dryRun: true,
      showOptimizedContent: true,
    });
    const resultIdx = out.indexOf('Result:');
    const tokensIdx = out.indexOf('Tokens :');
    const tokenizerIdx = out.indexOf('Tokenizer:');
    const textIdx = out.indexOf('Result text:');
    expect(resultIdx).toBeGreaterThan(-1);
    expect(tokensIdx).toBeGreaterThan(resultIdx);
    expect(tokenizerIdx).toBeGreaterThan(tokensIdx);
    expect(textIdx).toBeGreaterThan(tokenizerIdx);
  });
});

describe('renderOptimizeJson', () => {
  it('returns valid JSON', () => {
    expect(() => JSON.parse(renderOptimizeJson(baseResult))).not.toThrow();
  });

  it('includes appliedChanges', () => {
    const parsed = JSON.parse(renderOptimizeJson(baseResult)) as { appliedChanges: unknown[] };
    expect(parsed.appliedChanges).toHaveLength(1);
  });

  it('includes tokenizer metadata when present', () => {
    const parsed = JSON.parse(renderOptimizeJson({ ...baseResult, tokenizer: { id: 'o200k_base' } })) as {
      tokenizer: { id: string };
    };
    expect(parsed.tokenizer.id).toBe('o200k_base');
  });

  it('includes transform selection metadata when present', () => {
    const parsed = JSON.parse(
      renderOptimizeJson({
        ...baseResult,
        transformSelection: {
          mode: 'except',
          activeTransformIds: ['collapse-formatting-rules'],
          requestedIds: ['remove-exact-duplicates'],
        },
      }),
    ) as { transformSelection: { mode: string; activeTransformIds: string[]; requestedIds: string[] } };
    expect(parsed.transformSelection).toEqual({
      mode: 'except',
      activeTransformIds: ['collapse-formatting-rules'],
      requestedIds: ['remove-exact-duplicates'],
    });
  });

  it('is unchanged by diff rendering options handled by the CLI', () => {
    const parsed = JSON.parse(renderOptimizeJson(baseResult)) as { appliedChanges: unknown[] };
    expect(parsed.appliedChanges).toHaveLength(1);
  });
});
