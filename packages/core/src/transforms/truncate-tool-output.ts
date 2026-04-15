import type { ITransform, TransformContext, TransformResult } from './types.js';
import type { AnalyzedBlock, OptimizationChange } from '../types.js';
import { isProtectedBlock } from '../protection.js';

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
const DEFAULT_HEAD_LINES = 10;
const DEFAULT_TAIL_LINES = 5;
const TRUNCATED_MARKER_RE = /^\[\.\.\. truncated \d+ lines? \.\.\.\]$/m;

/** Lines in the truncated middle worth preserving. */
const IMPORTANT_LINE_RE = /\b(error|warning|exception|failed|failure|traceback)\b/i;

export type TruncateToolOutputOptions = {
  tokenThreshold?: number;
  headLines?: number;
  tailLines?: number;
  importantLinePattern?: RegExp;
};

export function createTruncateToolOutput(
  options: TruncateToolOutputOptions = {},
): ITransform {
  const tokenThreshold = options.tokenThreshold ?? TOOL_OUTPUT_TOKEN_THRESHOLD;
  const headLines = options.headLines ?? DEFAULT_HEAD_LINES;
  const tailLines = options.tailLines ?? DEFAULT_TAIL_LINES;
  const importantLinePattern = options.importantLinePattern ?? IMPORTANT_LINE_RE;

  return {
    id: 'truncate-tool-output',
    description: `Truncates tool_output blocks exceeding ${tokenThreshold} tokens`,

    apply({ blocks, tokenizer }: TransformContext): TransformResult {
      const changes: OptimizationChange[] = [];

      const newBlocks: AnalyzedBlock[] = blocks.map(block => {
        if (isProtectedBlock(block)) return block;
        if (block.type !== 'tool_output' || block.tokenCount <= tokenThreshold) {
          return block;
        }
        if (TRUNCATED_MARKER_RE.test(block.content)) return block;

        const lines = block.content.split('\n');

        // Nothing to truncate if the block fits in head + tail already.
        if (lines.length <= headLines + tailLines) return block;

        const head = lines.slice(0, headLines);
        const tail = lines.slice(-tailLines);
        const middle = lines.slice(headLines, lines.length - tailLines);

        const importantLines = middle.filter(l => importantLinePattern.test(l));
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
          reason: `tool_output exceeded ${tokenThreshold} tokens (was ${block.tokenCount})`,
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

export const truncateToolOutput: ITransform = createTruncateToolOutput();
