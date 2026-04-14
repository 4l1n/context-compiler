import type { IRule, LintContext } from '../types.js';
import type { AnalysisIssue } from '@context-compiler/core';

/**
 * noisy-tool-output
 *
 * Warns when a tool_output block exceeds the token threshold.
 * Large tool outputs (stack traces, raw API responses, verbose logs) bloat
 * the context without improving the model's understanding.
 *
 * One issue per offending block, with the exact token count in the message.
 */

/** Max tokens a single tool_output block may have before a warning is emitted. */
export const TOOL_OUTPUT_TOKEN_THRESHOLD = 300;

export const noisyToolOutput: IRule = {
  id: 'noisy-tool-output',
  description: `Warns when a tool_output block exceeds ${TOOL_OUTPUT_TOKEN_THRESHOLD} tokens`,

  check({ blocks }: LintContext): AnalysisIssue[] {
    return blocks
      .filter(b => b.type === 'tool_output' && b.tokenCount > TOOL_OUTPUT_TOKEN_THRESHOLD)
      .map(b => ({
        ruleId: 'noisy-tool-output',
        severity: 'warning' as const,
        message: `Tool output is ${b.tokenCount} tokens (threshold: ${TOOL_OUTPUT_TOKEN_THRESHOLD}) — truncate or summarize`,
        blockId: b.id,
      }));
  },
};
