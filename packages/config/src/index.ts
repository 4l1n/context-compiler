export type {
  Config,
  IdToggleConfig,
  TokenizerConfig,
  LintWarningThresholds,
  LintRuleThresholds,
  OptimizeTransformThresholds,
  ContextCompilerConfig,
  ContextCompilerConfigInput,
  ConfigValidationOptions,
} from './types.js';
export { defaultConfig, resolveConfig } from './types.js';

export type { LoadConfigOptions } from './load.js';
export { DEFAULT_CONFIG_FILENAME, loadConfig } from './load.js';
