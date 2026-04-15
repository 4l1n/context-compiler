import type { AnalysisReport, AnalyzedBlock } from '@context-compiler/core';
import { isProtectedBlock } from '@context-compiler/core';

export function hasDirectCompactionSignal(report: AnalysisReport): boolean {
  return hasDuplicateBlockSignal(report.blocks) || hasRepeatedSentenceSignal(report.blocks);
}

function hasDuplicateBlockSignal(blocks: AnalyzedBlock[]): boolean {
  const seen = new Set<string>();
  for (const block of blocks) {
    if (isProtectedBlock(block)) continue;
    const key = block.content.trim();
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function hasRepeatedSentenceSignal(blocks: AnalyzedBlock[]): boolean {
  // Strong direct signal only: exact consecutive sentence repetition.
  const repeatedSentencePattern = /(^|\s)([^.!?\n]+[.!?])\s+\2(?=\s|$)/;
  for (const block of blocks) {
    if (isProtectedBlock(block)) continue;
    if (block.type === 'structured_data' || block.type === 'tool_output') continue;
    if (repeatedSentencePattern.test(block.content)) return true;
  }
  return false;
}
