import type { ITransform, TransformContext, TransformResult } from './types.js';
import type { AnalyzedBlock, OptimizationChange } from '../types.js';
import { isProtectedBlock } from '../protection.js';

/**
 * trim-oversized-examples
 *
 * When example blocks collectively exceed EXAMPLE_MAX_PERCENT of the total
 * prompt tokens, individual example blocks are trimmed to at most EXAMPLE_MIN_LINES
 * lines (keeping the first MIN_LINES as a representative excerpt).
 *
 * Only example blocks that are individually over-budget are trimmed — those
 * already at or under MIN_LINES are left alone.
 * A truncation marker is appended so readers know content was removed.
 */

export const EXAMPLE_MAX_PERCENT = 40;
const DEFAULT_EXAMPLE_MIN_LINES = 5;
const EXAMPLE_TRUNCATED_MARKER_RE = /^\[\.\.\. example truncated \d+ lines? \.\.\.\]$/m;

export type TrimOversizedExamplesOptions = {
  maxPercent?: number;
  minLines?: number;
};

export function createTrimOversizedExamples(
  options: TrimOversizedExamplesOptions = {},
): ITransform {
  const maxPercent = options.maxPercent ?? EXAMPLE_MAX_PERCENT;
  const minLines = options.minLines ?? DEFAULT_EXAMPLE_MIN_LINES;

  return {
    id: 'trim-oversized-examples',
    description: `Trims example blocks when they exceed ${maxPercent}% of total tokens`,

    apply({ blocks, totalTokens, tokenizer }: TransformContext): TransformResult {
      if (totalTokens === 0) return { blocks, changes: [] };

      const unprotectedBlocks = blocks.filter(block => !isProtectedBlock(block));
      const unprotectedTotalTokens = unprotectedBlocks.reduce((sum, block) => sum + block.tokenCount, 0);
      if (unprotectedTotalTokens === 0) return { blocks, changes: [] };

      const exampleBlocks = unprotectedBlocks.filter(b => b.type === 'example');
      const exampleTokens = exampleBlocks.reduce((s, b) => s + b.tokenCount, 0);
      const examplePercent = (exampleTokens / unprotectedTotalTokens) * 100;

      if (examplePercent <= maxPercent) return { blocks, changes: [] };

      const changes: OptimizationChange[] = [];

      const newBlocks: AnalyzedBlock[] = blocks.map(block => {
        if (isProtectedBlock(block)) return block;
        if (block.type !== 'example') return block;
        if (EXAMPLE_TRUNCATED_MARKER_RE.test(block.content)) return block;

        const lines = block.content.split('\n');
        if (lines.length <= minLines) return block;

        const kept = lines.slice(0, minLines);
        const truncatedCount = lines.length - minLines;
        const newContent =
          kept.join('\n') +
          `\n[... example truncated ${truncatedCount} line${truncatedCount > 1 ? 's' : ''} ...]`;

        const tokensAfter = tokenizer.count(newContent);
        if (tokensAfter >= block.tokenCount) return block;

        changes.push({
          type: 'replace',
          transformId: 'trim-oversized-examples',
          blockIds: [block.id],
          before: block.content,
          after: newContent,
          reason: `Example blocks use ${Math.round(examplePercent)}% of total tokens (threshold: ${maxPercent}%)`,
          tokenDelta: tokensAfter - block.tokenCount,
        });

        return {
          ...block,
          content: newContent,
          tokenCount: tokensAfter,
        };
      });

      return { blocks: newBlocks, changes };
    },
  };
}

export const trimOversizedExamples: ITransform = createTrimOversizedExamples();
