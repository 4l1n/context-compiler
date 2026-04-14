import type { AnalyzedBlock, AnalysisIssue } from './types.js';

export const WARN_THRESHOLDS = {
  /** Token count above which any block is flagged. */
  blockTooLong: 500,
  /** Token count above which a structured_data block is flagged. */
  structuredDataTooLarge: 200,
  /** Token count above which a tool_output block is flagged. */
  toolOutputTooLarge: 300,
  /** Ratio (0–1) of unknown blocks that triggers a warning. */
  unknownRatio: 0.3,
} as const;

/**
 * Produce warnings for an analyzed block list.
 * These are heuristic thresholds, not hard errors.
 */
export function checkWarnings(blocks: AnalyzedBlock[]): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];

  for (const block of blocks) {
    if (block.tokenCount > WARN_THRESHOLDS.blockTooLong) {
      issues.push({
        ruleId: 'block-too-long',
        severity: 'warning',
        message: `Block is ${block.tokenCount} tokens (threshold: ${WARN_THRESHOLDS.blockTooLong})`,
        blockId: block.id,
      });
    }

    if (block.type === 'structured_data' && block.tokenCount > WARN_THRESHOLDS.structuredDataTooLarge) {
      issues.push({
        ruleId: 'structured-data-too-large',
        severity: 'warning',
        message: `Structured data block is ${block.tokenCount} tokens — consider summarizing or extracting`,
        blockId: block.id,
      });
    }

    if (block.type === 'tool_output' && block.tokenCount > WARN_THRESHOLDS.toolOutputTooLarge) {
      issues.push({
        ruleId: 'tool-output-too-large',
        severity: 'warning',
        message: `Tool output block is ${block.tokenCount} tokens — consider truncating`,
        blockId: block.id,
      });
    }
  }

  const unknownCount = blocks.filter(b => b.type === 'unknown').length;
  if (blocks.length > 0 && unknownCount / blocks.length > WARN_THRESHOLDS.unknownRatio) {
    issues.push({
      ruleId: 'too-many-unknown-blocks',
      severity: 'info',
      message: `${unknownCount}/${blocks.length} blocks are unclassified (${Math.round((unknownCount / blocks.length) * 100)}%) — consider restructuring`,
    });
  }

  return issues;
}
