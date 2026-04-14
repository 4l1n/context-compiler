export type {
  PromptRole,
  PromptBlock,
  BlockType,
  AnalyzedBlock,
  IssueSeverity,
  AnalysisIssue,
  AnalysisReport,
  ChangeType,
  OptimizationChange,
  OptimizationResult,
  ITokenizer,
} from './types.js';

export { loadFile } from './loader.js';
export { parseBlocks } from './parser.js';
export type { RawBlock } from './parser.js';
export { classifyBlock } from './classifier.js';
export { checkWarnings, WARN_THRESHOLDS, DEFAULT_WARNING_THRESHOLDS } from './warnings.js';
export type { WarningThresholds } from './warnings.js';
export { buildReport, analyze } from './analyzer.js';
export type { BuildReportOptions } from './analyzer.js';
export { runOptimize } from './optimizer.js';
export type {
  ITransform,
  TransformContext,
  TransformResult,
  TransformBuildOptions,
} from './transforms/index.js';
export {
  DEFAULT_TRANSFORMS,
  KNOWN_TRANSFORM_IDS,
  buildTransforms,
  removeExactDuplicates,
  collapseFormattingRules,
  truncateToolOutput,
  trimOversizedExamples,
  TOOL_OUTPUT_TOKEN_THRESHOLD,
  EXAMPLE_MAX_PERCENT,
} from './transforms/index.js';
