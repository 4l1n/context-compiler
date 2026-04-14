import type { IRule, LintContext } from '../types.js';
import type { AnalysisIssue } from '@context-compiler/core';

/**
 * oversized-example-section
 *
 * Warns when example blocks collectively consume too large a share of total tokens.
 * Heavy example sections leave less budget for instructions and constraints.
 *
 * Threshold: examples must not exceed EXAMPLE_RATIO_THRESHOLD of total tokens.
 * Change this constant to tighten or relax the check.
 */

/** Max ratio (0–1) of total tokens that example blocks may occupy before a warning is emitted. */
export const EXAMPLE_RATIO_THRESHOLD = 0.4;

export const oversizedExampleSection: IRule = {
  id: 'oversized-example-section',
  description: `Warns when example blocks exceed ${Math.round(EXAMPLE_RATIO_THRESHOLD * 100)}% of total tokens`,

  check({ blocks, totalTokens }: LintContext): AnalysisIssue[] {
    if (totalTokens === 0) return [];

    const exampleBlocks = blocks.filter(b => b.type === 'example');
    if (exampleBlocks.length === 0) return [];

    const exampleTokens = exampleBlocks.reduce((sum, b) => sum + b.tokenCount, 0);
    const ratio = exampleTokens / totalTokens;

    if (ratio <= EXAMPLE_RATIO_THRESHOLD) return [];

    const pct = Math.round(ratio * 100);
    const threshold = Math.round(EXAMPLE_RATIO_THRESHOLD * 100);
    const ids = exampleBlocks.map(b => b.id).join(', ');

    return [
      {
        ruleId: 'oversized-example-section',
        severity: 'warning',
        message: `Example blocks use ${pct}% of total tokens (${exampleTokens}/${totalTokens}) — threshold: ${threshold}% (blocks: ${ids})`,
      },
    ];
  },
};
