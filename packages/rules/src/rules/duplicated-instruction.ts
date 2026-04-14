import type { IRule, LintContext } from '../types.js';
import type { AnalysisIssue, AnalyzedBlock } from '@context-compiler/core';

/**
 * duplicated-instruction
 *
 * Detects instruction or constraint blocks that are exact copies or
 * near-duplicates of each other.
 *
 * Heuristics (applied in order per pair):
 *  1. Exact match after normalization → severity 'error'
 *     Normalization: lowercase + collapse whitespace + strip punctuation
 *  2. High word-set overlap (Jaccard ≥ 0.7) on blocks with ≥ 5 words → severity 'warning'
 *     Jaccard = |A ∩ B| / |A ∪ B| on unique word sets
 *
 * Scoped to: instruction + constraint blocks only.
 * Only the later block in document order is flagged.
 */

const RELEVANT_TYPES = new Set<string>(['instruction', 'constraint']);
const SIMILARITY_THRESHOLD = 0.7;
const MIN_WORDS_FOR_SIMILARITY = 5;

export const duplicatedInstruction: IRule = {
  id: 'duplicated-instruction',
  description: 'Detects exact or near-duplicate instruction/constraint blocks',

  check({ blocks }: LintContext): AnalysisIssue[] {
    const relevant = blocks.filter(b => RELEVANT_TYPES.has(b.type));
    const issues: AnalysisIssue[] = [];

    for (let i = 0; i < relevant.length; i++) {
      for (let j = i + 1; j < relevant.length; j++) {
        const a = relevant[i] as AnalyzedBlock;
        const b = relevant[j] as AnalyzedBlock;

        const normA = normalize(a.content);
        const normB = normalize(b.content);

        if (normA === normB) {
          issues.push({
            ruleId: 'duplicated-instruction',
            severity: 'error',
            message: `Exact duplicate of ${a.id} — remove or merge`,
            blockId: b.id,
          });
          continue;
        }

        const wordsA = wordSet(normA);
        const wordsB = wordSet(normB);

        if (wordsA.size >= MIN_WORDS_FOR_SIMILARITY && wordsB.size >= MIN_WORDS_FOR_SIMILARITY) {
          const sim = jaccard(wordsA, wordsB);
          if (sim >= SIMILARITY_THRESHOLD) {
            issues.push({
              ruleId: 'duplicated-instruction',
              severity: 'warning',
              message: `${Math.round(sim * 100)}% word overlap with ${a.id} — possible duplicate`,
              blockId: b.id,
            });
          }
        }
      }
    }

    return issues;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const w of a) {
    if (b.has(w)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
