import type { ITransform, TransformContext, TransformResult } from './types.js';
import type { AnalyzedBlock, BlockType, OptimizationChange } from '../types.js';
import { isProtectedBlock } from '../protection.js';

const SKIPPED_TYPES: Set<BlockType> = new Set(['structured_data', 'tool_output']);

type ParsedSentence = {
  sentence: string;
  separator: string;
};

/**
 * collapse-repeated-sentences
 *
 * Conservative intra-block sentence dedupe:
 * - only exact, consecutive repeats
 * - only when sentence segmentation is unambiguous
 * - no fuzzy matching, reordering, or semantic rewriting
 */
export const collapseRepeatedSentences: ITransform = {
  id: 'collapse-repeated-sentences',
  description: 'Collapses exact consecutive repeated sentences inside a single block',

  apply({ blocks, tokenizer }: TransformContext): TransformResult {
    const changes: OptimizationChange[] = [];

    const nextBlocks: AnalyzedBlock[] = blocks.map(block => {
      if (isProtectedBlock(block)) return block;
      if (SKIPPED_TYPES.has(block.type)) return block;

      const parsed = parseUnambiguousSentences(block.content);
      if (!parsed || parsed.length < 2) return block;

      const kept: ParsedSentence[] = [];
      let removed = 0;

      for (const entry of parsed) {
        const previous = kept[kept.length - 1];
        if (previous && previous.sentence === entry.sentence) {
          removed++;
          continue;
        }
        kept.push(entry);
      }

      if (removed === 0) return block;

      const nextContent = kept.map(entry => `${entry.sentence}${entry.separator}`).join('').trim();
      if (nextContent === '' || nextContent === block.content) return block;

      const nextTokens = tokenizer.count(nextContent);
      if (nextTokens >= block.tokenCount) return block;

      changes.push({
        type: 'replace',
        transformId: 'collapse-repeated-sentences',
        blockIds: [block.id],
        before: block.content,
        after: nextContent,
        reason: `Collapsed ${removed} consecutive repeated sentence${removed === 1 ? '' : 's'}`,
        tokenDelta: nextTokens - block.tokenCount,
      });

      return {
        ...block,
        content: nextContent,
        tokenCount: nextTokens,
      };
    });

    return { blocks: nextBlocks, changes };
  },
};

function parseUnambiguousSentences(content: string): ParsedSentence[] | undefined {
  const sentenceRegex = /([^.!?\n]+[.!?])(\s*)/g;
  const sentences: ParsedSentence[] = [];
  let cursor = 0;

  for (const match of content.matchAll(sentenceRegex)) {
    const index = match.index ?? 0;
    if (index !== cursor) {
      const gap = content.slice(cursor, index);
      if (gap.trim().length > 0) return undefined;
    }

    const rawSentence = match[1];
    const separator = match[2] ?? '';
    if (!rawSentence) return undefined;

    const sentence = rawSentence.trim();
    // Conservative safety gate: allow only plain sentence bodies with one
    // terminal punctuation marker.
    if (!/^[^.!?\n]+[.!?]$/.test(sentence)) return undefined;

    sentences.push({ sentence, separator });
    cursor = index + match[0].length;
  }

  const tail = content.slice(cursor);
  if (tail.trim().length > 0) return undefined;

  return sentences;
}
