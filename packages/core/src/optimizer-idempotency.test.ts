import { describe, expect, it } from 'vitest';
import { promptFixtures } from '@context-compiler/fixtures';
import { buildReport } from './analyzer.js';
import { runOptimize } from './optimizer.js';
import { buildTransforms } from './transforms/index.js';
import type { ITokenizer } from './types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

describe('runOptimize idempotency', () => {
  it.each(promptFixtures)('reaches a fixed point for $id', fixture => {
    const path = `/fixtures/${fixture.id}.md`;
    const transforms = buildTransforms();

    const firstReport = buildReport(path, fixture.content, '.md', tok);
    const first = runOptimize(path, fixture.content, firstReport, transforms, tok);

    const secondReport = buildReport(path, first.optimizedContent, '.md', tok);
    const second = runOptimize(path, first.optimizedContent, secondReport, transforms, tok);

    expect(second.appliedChanges).toEqual([]);
    expect(second.optimizedContent).toBe(first.optimizedContent);
    expect(second.tokenSavings).toBe(0);
  });
});
