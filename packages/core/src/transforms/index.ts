export type { ITransform, TransformContext, TransformResult } from './types.js';
export { removeExactDuplicates } from './remove-exact-duplicates.js';
export { collapseFormattingRules } from './collapse-formatting-rules.js';
export {
  truncateToolOutput,
  TOOL_OUTPUT_TOKEN_THRESHOLD,
  createTruncateToolOutput,
} from './truncate-tool-output.js';
export {
  trimOversizedExamples,
  EXAMPLE_MAX_PERCENT,
  createTrimOversizedExamples,
} from './trim-oversized-examples.js';

import { removeExactDuplicates } from './remove-exact-duplicates.js';
import { collapseFormattingRules } from './collapse-formatting-rules.js';
import { createTruncateToolOutput, truncateToolOutput } from './truncate-tool-output.js';
import { createTrimOversizedExamples, trimOversizedExamples } from './trim-oversized-examples.js';
import type { ITransform } from './types.js';

export const DEFAULT_TRANSFORMS: ITransform[] = [
  removeExactDuplicates,
  collapseFormattingRules,
  truncateToolOutput,
  trimOversizedExamples,
];

export type TransformBuildOptions = {
  enabledTransformIds?: string[];
  disabledTransformIds?: string[];
  thresholds?: {
    truncateToolOutputTokens?: number;
    trimOversizedExamplesPercent?: number;
  };
};

export function buildTransforms(options: TransformBuildOptions = {}): ITransform[] {
  const truncateTransform = createTruncateToolOutput({
    tokenThreshold: options.thresholds?.truncateToolOutputTokens,
  });
  const trimTransform = createTrimOversizedExamples({
    maxPercent: options.thresholds?.trimOversizedExamplesPercent,
  });

  const ordered: ITransform[] = [
    removeExactDuplicates,
    collapseFormattingRules,
    truncateTransform,
    trimTransform,
  ];

  const enabled = new Set(options.enabledTransformIds ?? []);
  const disabled = new Set(options.disabledTransformIds ?? []);

  return ordered.filter(transform => {
    if (enabled.size > 0 && !enabled.has(transform.id)) return false;
    if (disabled.has(transform.id)) return false;
    return true;
  });
}
