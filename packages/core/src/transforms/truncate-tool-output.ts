import type { ITransform, TransformContext, TransformResult } from './types.js';
import type { AnalyzedBlock, OptimizationChange } from '../types.js';

/**
 * truncate-tool-output
 *
 * For tool_output blocks exceeding TOKEN_THRESHOLD tokens:
 *  - Keeps HEAD_LINES lines from the start.
 *  - Keeps TAIL_LINES lines from the end.
 *  - Preserves any lines (from the truncated middle) that match IMPORTANT_LINE_RE
 *    (errors, warnings, exceptions, failures).
 *  - Inserts a '[... truncated N lines ...]' marker between head and tail sections.
 */

export const TOOL_OUTPUT_TOKEN_THRESHOLD = 300;
const HEAD_LINES = 10;
const TAIL_LINES = 5;
const TRUNCATED_MARKER_RE = /^\[\.\.\. truncated \d+ lines? \.\.\.\]$/m;

/** Lines in the truncated middle worth preserving. */
const IMPORTANT_LINE_RE = /\b(error|warning|exception|failed|failure|traceback)\b/i;

export const truncateToolOutput: ITransform = {
  id: 'truncate-tool-output',
  description: `Truncates tool_output blocks exceeding ${TOOL_OUTPUT_TOKEN_THRESHOLD} tokens`,

  apply({ blocks, tokenizer }: TransformContext): TransformResult {
    const changes: OptimizationChange[] = [];

    const newBlocks: AnalyzedBlock[] = blocks.map(block => {
      if (block.type !== 'tool_output' || block.tokenCount <= TOOL_OUTPUT_TOKEN_THRESHOLD) {
        return block;
      }
      if (TRUNCATED_MARKER_RE.test(block.content)) return block;

      const lines = block.content.split('\n');

      // Nothing to truncate if the block fits in head + tail already.
      if (lines.length <= HEAD_LINES + TAIL_LINES) return block;

      const head = lines.slice(0, HEAD_LINES);
      const tail = lines.slice(-TAIL_LINES);
      const middle = lines.slice(HEAD_LINES, lines.length - TAIL_LINES);

      const importantLines = middle.filter(l => IMPORTANT_LINE_RE.test(l));
      const truncatedCount = middle.length - importantLines.length;

      const markerParts: string[] = [];
      if (truncatedCount > 0) {
        markerParts.push(`[... truncated ${truncatedCount} line${truncatedCount > 1 ? 's' : ''} ...]`);
      }
      if (importantLines.length > 0) {
        markerParts.push(...importantLines);
      }

      const newContent = [...head, ...markerParts, ...tail].join('\n');
      const tokensAfter = tokenizer.count(newContent);
      if (tokensAfter >= block.tokenCount) return block;

      changes.push({
        type: 'replace',
        transformId: 'truncate-tool-output',
        blockIds: [block.id],
        before: block.content,
        after: newContent,
        reason: `tool_output exceeded ${TOOL_OUTPUT_TOKEN_THRESHOLD} tokens (was ${block.tokenCount})`,
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
