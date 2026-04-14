export type { IRule, LintContext, LintResult } from './types.js';
export { runLint } from './runner.js';

export { duplicatedInstruction } from './rules/duplicated-instruction.js';
export { repeatedFormattingRules, FORMATTING_PATTERNS } from './rules/repeated-formatting-rules.js';
export {
  oversizedExampleSection,
  EXAMPLE_RATIO_THRESHOLD,
  createOversizedExampleSectionRule,
} from './rules/oversized-example-section.js';
export {
  noisyToolOutput,
  TOOL_OUTPUT_TOKEN_THRESHOLD,
  createNoisyToolOutputRule,
} from './rules/noisy-tool-output.js';

import type { IRule } from './types.js';
import { duplicatedInstruction } from './rules/duplicated-instruction.js';
import { repeatedFormattingRules } from './rules/repeated-formatting-rules.js';
import {
  createOversizedExampleSectionRule,
  oversizedExampleSection,
} from './rules/oversized-example-section.js';
import { createNoisyToolOutputRule, noisyToolOutput } from './rules/noisy-tool-output.js';

/** The default set of rules run by `context-compiler lint`. */
export const DEFAULT_RULES: IRule[] = [
  duplicatedInstruction,
  repeatedFormattingRules,
  oversizedExampleSection,
  noisyToolOutput,
];

export type RuleBuildOptions = {
  enabledRuleIds?: string[];
  disabledRuleIds?: string[];
  thresholds?: {
    noisyToolOutputTokens?: number;
    oversizedExampleRatio?: number;
  };
};

export function buildRules(options: RuleBuildOptions = {}): IRule[] {
  const oversizedExamples = createOversizedExampleSectionRule(
    options.thresholds?.oversizedExampleRatio,
  );
  const noisyTool = createNoisyToolOutputRule(options.thresholds?.noisyToolOutputTokens);

  const ordered: IRule[] = [
    duplicatedInstruction,
    repeatedFormattingRules,
    oversizedExamples,
    noisyTool,
  ];

  const enabled = new Set(options.enabledRuleIds ?? []);
  const disabled = new Set(options.disabledRuleIds ?? []);

  return ordered.filter(rule => {
    if (enabled.size > 0 && !enabled.has(rule.id)) return false;
    if (disabled.has(rule.id)) return false;
    return true;
  });
}
