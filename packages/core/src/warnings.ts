import type { AnalyzedBlock, AnalysisIssue } from './types.js';

export type WarningThresholds = {
  /** Token count above which any block is flagged. */
  blockTooLong: number;
  /** Token count above which a structured_data block is flagged. */
  structuredDataTooLarge: number;
  /** Token count above which a tool_output block is flagged. */
  toolOutputTooLarge: number;
  /** Ratio (0–1) of unknown blocks that triggers a warning. */
  unknownRatio: number;
};

export const DEFAULT_WARNING_THRESHOLDS: WarningThresholds = {
  blockTooLong: 500,
  structuredDataTooLarge: 200,
  toolOutputTooLarge: 300,
  unknownRatio: 0.3,
} as const;

/** Backwards-compatible alias. */
export const WARN_THRESHOLDS = DEFAULT_WARNING_THRESHOLDS;

/**
 * Produce warnings for an analyzed block list.
 * These are heuristic thresholds, not hard errors.
 */
export function checkWarnings(
  blocks: AnalyzedBlock[],
  thresholds: WarningThresholds = DEFAULT_WARNING_THRESHOLDS,
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];

  for (const block of blocks) {
    if (block.tokenCount > thresholds.blockTooLong) {
      issues.push({
        ruleId: 'block-too-long',
        severity: 'warning',
        message: `Block is ${block.tokenCount} tokens (threshold: ${thresholds.blockTooLong})`,
        blockId: block.id,
      });
    }

    if (block.type === 'structured_data' && block.tokenCount > thresholds.structuredDataTooLarge) {
      issues.push({
        ruleId: 'structured-data-too-large',
        severity: 'warning',
        message: `Structured data block is ${block.tokenCount} tokens — consider summarizing or extracting`,
        blockId: block.id,
      });
    }

    if (block.type === 'tool_output' && block.tokenCount > thresholds.toolOutputTooLarge) {
      issues.push({
        ruleId: 'tool-output-too-large',
        severity: 'warning',
        message: `Tool output block is ${block.tokenCount} tokens — consider truncating`,
        blockId: block.id,
      });
    }
  }

  const unknownCount = blocks.filter(b => b.type === 'unknown').length;
  if (blocks.length > 0 && unknownCount / blocks.length > thresholds.unknownRatio) {
    issues.push({
      ruleId: 'too-many-unknown-blocks',
      severity: 'info',
      message: `${unknownCount}/${blocks.length} blocks are unclassified (${Math.round((unknownCount / blocks.length) * 100)}%) — consider restructuring`,
    });
  }

  return issues;
}
