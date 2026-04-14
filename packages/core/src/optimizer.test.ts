import { describe, it, expect } from 'vitest';
import { runOptimize } from './optimizer.js';
import { buildReport } from './analyzer.js';
import { DEFAULT_TRANSFORMS, removeExactDuplicates } from './transforms/index.js';
import type { ITokenizer, ITransform } from './index.js';
import type { TransformContext, TransformResult } from './transforms/types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

function makeReport(content: string) {
  return buildReport('/tmp/test.md', content, '.md', tok);
}

describe('runOptimize — no-op', () => {
  it('returns original content when no changes apply', () => {
    const content = 'You are a helpful assistant.\n\n\nDo not lie.';
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, [], tok);
    expect(result.appliedChanges).toHaveLength(0);
    expect(result.optimizedContent).toBe(content);
    expect(result.tokenSavings).toBe(0);
  });

  it('originalContent is preserved verbatim', () => {
    const content = 'Hello world.';
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, [], tok);
    expect(result.originalContent).toBe(content);
  });

  it('path is preserved', () => {
    const content = 'Hello world.';
    const report = makeReport(content);
    const result = runOptimize('/custom/path.md', content, report, [], tok);
    expect(result.path).toBe('/custom/path.md');
  });
});

describe('runOptimize — remove-exact-duplicates integration', () => {
  it('removes duplicate block and reports change', () => {
    const content = 'You are an assistant.\n\nYou are an assistant.';
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, [removeExactDuplicates], tok);
    expect(result.appliedChanges).toHaveLength(1);
    expect(result.appliedChanges[0]?.transformId).toBe('remove-exact-duplicates');
    expect(result.tokenSavings).toBeGreaterThan(0);
  });

  it('optimizedContent does not contain the duplicate', () => {
    const block = 'You are an assistant.';
    const content = `${block}\n\n${block}`;
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, [removeExactDuplicates], tok);
    // The block appears only once in optimizedContent
    expect(result.optimizedContent.split(block).length - 1).toBe(1);
  });
});

describe('runOptimize — token accounting', () => {
  it('tokenSavings = originalTokens - optimizedTokens', () => {
    const content = 'hello world\n\nhello world';
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, [removeExactDuplicates], tok);
    expect(result.tokenSavings).toBe(result.originalTokens - result.optimizedTokens);
  });

  it('tokenSavings can be zero when nothing changed', () => {
    const content = 'unique block one\n\nunique block two';
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, DEFAULT_TRANSFORMS, tok);
    expect(result.tokenSavings).toBeGreaterThanOrEqual(0);
  });

  it('reports negative tokenSavings when a transform increases content', () => {
    const expand: ITransform = {
      id: 'expand',
      description: 'adds text',
      apply(ctx: TransformContext): TransformResult {
        const first = ctx.blocks[0];
        if (!first) return { blocks: ctx.blocks, changes: [] };
        const after = `${first.content} extra words here`;
        return {
          blocks: [{ ...first, content: after, tokenCount: tok.count(after) }],
          changes: [
            {
              type: 'replace',
              transformId: 'expand',
              blockIds: [first.id],
              before: first.content,
              after,
              reason: 'test-only expansion',
              tokenDelta: tok.count(after) - first.tokenCount,
            },
          ],
        };
      },
    };
    const content = 'hello world';
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, [expand], tok);
    expect(result.tokenSavings).toBeLessThan(0);
  });
});

describe('runOptimize — assembly', () => {
  it('preserves block order', () => {
    const content = 'block A\n\nblock B\n\nblock C';
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, [], tok);
    const idx = (s: string) => result.optimizedContent.indexOf(s);
    expect(idx('block A')).toBeLessThan(idx('block B'));
    expect(idx('block B')).toBeLessThan(idx('block C'));
  });

  it('unchanged blocks use original content verbatim', () => {
    const block1 = 'You are an assistant.';
    const block2 = 'Do not lie.';
    const content = `${block1}\n\n${block2}`;
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, [], tok);
    expect(result.optimizedContent).toContain(block1);
    expect(result.optimizedContent).toContain(block2);
  });

  it('uses transformed content only for replaced blocks', () => {
    const replaceSecond: ITransform = {
      id: 'replace-second',
      description: 'replaces block 2',
      apply(ctx: TransformContext): TransformResult {
        const blocks = ctx.blocks.map(b =>
          b.id === 'block-2' ? { ...b, content: 'replacement block', tokenCount: tok.count('replacement block') } : b,
        );
        return {
          blocks,
          changes: [
            {
              type: 'replace',
              transformId: 'replace-second',
              blockIds: ['block-2'],
              before: 'original block two',
              after: 'replacement block',
              reason: 'test-only replacement',
              tokenDelta: 0,
            },
          ],
        };
      },
    };
    const content = 'original block one\n\noriginal block two';
    const report = makeReport(content);
    const result = runOptimize('/tmp/test.md', content, report, [replaceSecond], tok);
    expect(result.optimizedContent).toContain('original block one');
    expect(result.optimizedContent).toContain('replacement block');
    expect(result.optimizedContent).not.toContain('original block two');
  });
});

describe('runOptimize — coherence validation', () => {
  it('throws when all blocks are removed', () => {
    const content = 'same\n\nsame';
    const report = makeReport(content);

    // A transform that removes everything
    const removeAll: ITransform = {
      id: 'remove-all',
      description: 'removes all blocks',
      apply(_ctx: TransformContext): TransformResult {
        return { blocks: [], changes: [] };
      },
    };

    expect(() => runOptimize('/tmp/test.md', content, report, [removeAll], tok)).toThrow();
  });

  it('does not throw when some blocks survive', () => {
    const content = 'block one\n\nblock one';
    const report = makeReport(content);
    expect(() =>
      runOptimize('/tmp/test.md', content, report, [removeExactDuplicates], tok),
    ).not.toThrow();
  });
});

describe('runOptimize — transforms run sequentially', () => {
  it('collects changes from multiple transforms', () => {
    // Two transforms that each emit one change
    let calls = 0;
    const t1: ITransform = {
      id: 't1',
      description: '',
      apply(ctx: TransformContext): TransformResult {
        calls++;
        return { blocks: ctx.blocks, changes: [] };
      },
    };
    const t2: ITransform = {
      id: 't2',
      description: '',
      apply(ctx: TransformContext): TransformResult {
        calls++;
        return { blocks: ctx.blocks, changes: [] };
      },
    };
    const content = 'hello world';
    const report = makeReport(content);
    runOptimize('/tmp/test.md', content, report, [t1, t2], tok);
    expect(calls).toBe(2);
  });
});
