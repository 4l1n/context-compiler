export type { ITransform, TransformContext, TransformResult } from './types.js';
export { removeExactDuplicates } from './remove-exact-duplicates.js';
export { collapseFormattingRules } from './collapse-formatting-rules.js';
export { truncateToolOutput, TOOL_OUTPUT_TOKEN_THRESHOLD } from './truncate-tool-output.js';
export { trimOversizedExamples, EXAMPLE_MAX_PERCENT } from './trim-oversized-examples.js';

import { removeExactDuplicates } from './remove-exact-duplicates.js';
import { collapseFormattingRules } from './collapse-formatting-rules.js';
import { truncateToolOutput } from './truncate-tool-output.js';
import { trimOversizedExamples } from './trim-oversized-examples.js';
import type { ITransform } from './types.js';

export const DEFAULT_TRANSFORMS: ITransform[] = [
  removeExactDuplicates,
  collapseFormattingRules,
  truncateToolOutput,
  trimOversizedExamples,
];
