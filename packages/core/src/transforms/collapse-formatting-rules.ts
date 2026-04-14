import type { ITransform, TransformContext, TransformResult } from './types.js';
import type { AnalyzedBlock, BlockType, OptimizationChange } from '../types.js';

/**
 * collapse-formatting-rules
 *
 * Detects formatting directives (lines matching known patterns) that appear
 * in multiple blocks and removes them from all blocks after the first occurrence.
 *
 * Guardrail: only applied to instruction, constraint, and memory blocks.
 * example, tool_output, structured_data, and unknown blocks are never touched.
 *
 * A "formatting directive line" is a line whose entire text matches one of the
 * FORMATTING_PATTERNS below (tested trimmed, case-insensitive).
 * Only whole-line matches are removed — partial inline mentions are left alone.
 */

const ELIGIBLE_TYPES: Set<BlockType> = new Set(['instruction', 'constraint', 'memory']);

type FormattingPattern = { id: string; label: string; regex: RegExp };

const FORMATTING_PATTERNS: FormattingPattern[] = [
  {
    id: 'be-concise',
    label: 'be concise',
    regex: /\b(be concise|keep (it|your (response|answer)) (concise|brief|short)|brevity is)\b/i,
  },
  {
    id: 'bullet-points',
    label: 'use bullet points',
    regex: /\b(use bullet[- ]?points?|format (your |the )?(response|answer|output) (as |with |using )?bullets?|bulleted list)\b/i,
  },
  {
    id: 'avoid-jargon',
    label: 'avoid jargon',
    regex: /\b(avoid jargon|no jargon|plain language|simple language|avoid technical terms)\b/i,
  },
  {
    id: 'avoid-verbose',
    label: 'avoid verbosity',
    regex: /\b(avoid verbosity|not (too )?verbose|don.t be verbose|avoid (being )?(wordy|verbose)|no (unnecessary|extra) words)\b/i,
  },
  {
    id: 'use-markdown',
    label: 'use markdown',
    regex: /\b(use markdown|format (with|using|in) markdown|respond (with|using|in) markdown|markdown format(ting)?)\b/i,
  },
  {
    id: 'numbered-list',
    label: 'use numbered lists',
    regex: /\b(use (a )?numbered list|format (as|with) (a )?numbered list|use (a )?numbered format)\b/i,
  },
  {
    id: 'no-repetition',
    label: 'no repetition',
    regex: /\b(don.t repeat (yourself|information)|do not repeat|avoid repeat(ing)?( yourself)?)\b/i,
  },
  {
    id: 'respond-in-language',
    label: 'respond in same language',
    regex: /\brespond (in|using) (the same |the user.?s )?(language|tongue)\b/i,
  },
  {
    id: 'step-by-step',
    label: 'think step by step',
    regex: /\b(think step[- ]by[- ]step|step[- ]by[- ]step (thinking|reasoning|approach)|reason step[- ]by[- ]step)\b/i,
  },
];

/** Returns true if the trimmed line matches a formatting pattern. */
function matchesPattern(line: string): FormattingPattern | undefined {
  const t = line.trim();
  if (!t) return undefined;
  return FORMATTING_PATTERNS.find(p => p.regex.test(t));
}

function isFenceBoundary(line: string): boolean {
  return line.trimStart().startsWith('```');
}

export const collapseFormattingRules: ITransform = {
  id: 'collapse-formatting-rules',
  description:
    'Removes formatting directives from instruction/constraint/memory blocks after their first occurrence',

  apply({ blocks, tokenizer }: TransformContext): TransformResult {
    // Track which pattern ids have been "claimed" by a previous block.
    const claimedPatterns = new Map<string, string>(); // patternId → first blockId that contains it
    const changes: OptimizationChange[] = [];

    const newBlocks: AnalyzedBlock[] = blocks.map(block => {
      if (!ELIGIBLE_TYPES.has(block.type)) return block;

      const lines = block.content.split('\n');
      const removedLinesByPattern: Map<string, string[]> = new Map(); // patternLabel → removed lines
      const keptLines: string[] = [];
      let inCodeFence = false;

      for (const line of lines) {
        if (isFenceBoundary(line)) {
          inCodeFence = !inCodeFence;
          keptLines.push(line);
          continue;
        }

        const pattern = inCodeFence ? undefined : matchesPattern(line);

        if (pattern) {
          const firstBlockId = claimedPatterns.get(pattern.id);
          if (firstBlockId !== undefined && firstBlockId !== block.id) {
            // Already seen in a previous block — remove this line.
            const existing = removedLinesByPattern.get(pattern.label) ?? [];
            existing.push(line.trim());
            removedLinesByPattern.set(pattern.label, existing);
            continue;
          }
          // First occurrence — claim it.
          if (!claimedPatterns.has(pattern.id)) {
            claimedPatterns.set(pattern.id, block.id);
          }
        }
        keptLines.push(line);
      }

      if (removedLinesByPattern.size === 0) return block;

      const newContent = keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      if (newContent === '') return block;

      const tokensBefore = block.tokenCount;
      const tokensAfter = tokenizer.count(newContent);
      if (tokensAfter >= tokensBefore) return block;

      const descriptions = [...removedLinesByPattern.entries()]
        .map(([label, lines]) => `"${label}" (${lines.length} line${lines.length > 1 ? 's' : ''})`)
        .join(', ');

      changes.push({
        type: 'replace',
        transformId: 'collapse-formatting-rules',
        blockIds: [block.id],
        before: block.content,
        after: newContent,
        reason: `Removed duplicate formatting directive${removedLinesByPattern.size > 1 ? 's' : ''}: ${descriptions}`,
        tokenDelta: tokensAfter - tokensBefore,
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
