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

export function createNoisyToolOutputRule(
  threshold: number = TOOL_OUTPUT_TOKEN_THRESHOLD,
): IRule {
  return {
    id: 'noisy-tool-output',
    description: `Warns when a tool_output block exceeds ${threshold} tokens`,

    check({ blocks }: LintContext): AnalysisIssue[] {
      return blocks
        .filter(b => b.type === 'tool_output' && b.tokenCount > threshold)
        .map(b => ({
          ruleId: 'noisy-tool-output',
          severity: 'warning' as const,
          message: `Tool output is ${b.tokenCount} tokens (threshold: ${threshold}) — truncate or summarize`,
          blockId: b.id,
        }));
    },
  };
}

export const noisyToolOutput: IRule = createNoisyToolOutputRule();
