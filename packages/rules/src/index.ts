export type { IRule, LintContext, LintResult } from './types.js';
export { runLint } from './runner.js';

export { duplicatedInstruction } from './rules/duplicated-instruction.js';
export { repeatedFormattingRules, FORMATTING_PATTERNS } from './rules/repeated-formatting-rules.js';
export { oversizedExampleSection, EXAMPLE_RATIO_THRESHOLD } from './rules/oversized-example-section.js';
export { noisyToolOutput, TOOL_OUTPUT_TOKEN_THRESHOLD } from './rules/noisy-tool-output.js';

import type { IRule } from './types.js';
import { duplicatedInstruction } from './rules/duplicated-instruction.js';
import { repeatedFormattingRules } from './rules/repeated-formatting-rules.js';
import { oversizedExampleSection } from './rules/oversized-example-section.js';
import { noisyToolOutput } from './rules/noisy-tool-output.js';

/** The default set of rules run by `context-compiler lint`. */
export const DEFAULT_RULES: IRule[] = [
  duplicatedInstruction,
  repeatedFormattingRules,
  oversizedExampleSection,
  noisyToolOutput,
];
