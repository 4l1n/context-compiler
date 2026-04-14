export type IdToggleConfig = {
  /** Empty means "all by default". */
  enabled: string[];
  disabled: string[];
};

export type TokenizerConfig = {
  default: 'char';
  char: {
    charsPerToken: number;
  };
};

export type LintWarningThresholds = {
  blockTooLong: number;
  structuredDataTooLarge: number;
  toolOutputTooLarge: number;
  unknownRatio: number;
};

export type LintRuleThresholds = {
  noisyToolOutputTokens: number;
  oversizedExampleRatio: number;
};

export type OptimizeTransformThresholds = {
  truncateToolOutputTokens: number;
  trimOversizedExamplesPercent: number;
};

export type ContextCompilerConfig = {
  tokenizer: TokenizerConfig;
  lint: {
    warnings: LintWarningThresholds;
    thresholds: LintRuleThresholds;
    rules: IdToggleConfig;
  };
  optimize: {
    thresholds: OptimizeTransformThresholds;
    transforms: IdToggleConfig;
  };
};

/** Backwards-compatible alias. */
export type Config = ContextCompilerConfig;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? U[]
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

export type ContextCompilerConfigInput = DeepPartial<ContextCompilerConfig>;

export type ConfigValidationOptions = {
  knownRuleIds?: readonly string[];
  knownTransformIds?: readonly string[];
};

export const defaultConfig: ContextCompilerConfig = {
  tokenizer: {
    default: 'char',
    char: {
      charsPerToken: 4,
    },
  },
  lint: {
    warnings: {
      blockTooLong: 500,
      structuredDataTooLarge: 200,
      toolOutputTooLarge: 300,
      unknownRatio: 0.3,
    },
    thresholds: {
      noisyToolOutputTokens: 300,
      oversizedExampleRatio: 0.4,
    },
    rules: {
      enabled: [],
      disabled: [],
    },
  },
  optimize: {
    thresholds: {
      truncateToolOutputTokens: 300,
      trimOversizedExamplesPercent: 40,
    },
    transforms: {
      enabled: [],
      disabled: [],
    },
  },
};

export function resolveConfig(
  input: ContextCompilerConfigInput = {},
  validation: ConfigValidationOptions = {},
): ContextCompilerConfig {
  const merged: ContextCompilerConfig = {
    tokenizer: {
      default: input.tokenizer?.default ?? defaultConfig.tokenizer.default,
      char: {
        charsPerToken: input.tokenizer?.char?.charsPerToken ?? defaultConfig.tokenizer.char.charsPerToken,
      },
    },
    lint: {
      warnings: {
        blockTooLong: input.lint?.warnings?.blockTooLong ?? defaultConfig.lint.warnings.blockTooLong,
        structuredDataTooLarge:
          input.lint?.warnings?.structuredDataTooLarge ?? defaultConfig.lint.warnings.structuredDataTooLarge,
        toolOutputTooLarge: input.lint?.warnings?.toolOutputTooLarge ?? defaultConfig.lint.warnings.toolOutputTooLarge,
        unknownRatio: input.lint?.warnings?.unknownRatio ?? defaultConfig.lint.warnings.unknownRatio,
      },
      thresholds: {
        noisyToolOutputTokens:
          input.lint?.thresholds?.noisyToolOutputTokens ?? defaultConfig.lint.thresholds.noisyToolOutputTokens,
        oversizedExampleRatio:
          input.lint?.thresholds?.oversizedExampleRatio ?? defaultConfig.lint.thresholds.oversizedExampleRatio,
      },
      rules: {
        enabled: [...(input.lint?.rules?.enabled ?? defaultConfig.lint.rules.enabled)],
        disabled: [...(input.lint?.rules?.disabled ?? defaultConfig.lint.rules.disabled)],
      },
    },
    optimize: {
      thresholds: {
        truncateToolOutputTokens:
          input.optimize?.thresholds?.truncateToolOutputTokens ?? defaultConfig.optimize.thresholds.truncateToolOutputTokens,
        trimOversizedExamplesPercent:
          input.optimize?.thresholds?.trimOversizedExamplesPercent ??
          defaultConfig.optimize.thresholds.trimOversizedExamplesPercent,
      },
      transforms: {
        enabled: [...(input.optimize?.transforms?.enabled ?? defaultConfig.optimize.transforms.enabled)],
        disabled: [...(input.optimize?.transforms?.disabled ?? defaultConfig.optimize.transforms.disabled)],
      },
    },
  };

  assertConfig(merged);
  assertKnownIds(merged.lint.rules.enabled, validation.knownRuleIds, 'config.lint.rules.enabled');
  assertKnownIds(merged.lint.rules.disabled, validation.knownRuleIds, 'config.lint.rules.disabled');
  assertKnownIds(
    merged.optimize.transforms.enabled,
    validation.knownTransformIds,
    'config.optimize.transforms.enabled',
  );
  assertKnownIds(
    merged.optimize.transforms.disabled,
    validation.knownTransformIds,
    'config.optimize.transforms.disabled',
  );
  return merged;
}

function assertConfig(config: ContextCompilerConfig): void {
  if (config.tokenizer.default !== 'char') {
    throw new Error(`config.tokenizer.default must be "char", got "${String(config.tokenizer.default)}"`);
  }
  assertPositiveInt(config.tokenizer.char.charsPerToken, 'config.tokenizer.char.charsPerToken');

  assertPositiveInt(config.lint.warnings.blockTooLong, 'config.lint.warnings.blockTooLong');
  assertPositiveInt(config.lint.warnings.structuredDataTooLarge, 'config.lint.warnings.structuredDataTooLarge');
  assertPositiveInt(config.lint.warnings.toolOutputTooLarge, 'config.lint.warnings.toolOutputTooLarge');
  assertRatio(config.lint.warnings.unknownRatio, 'config.lint.warnings.unknownRatio');

  assertPositiveInt(config.lint.thresholds.noisyToolOutputTokens, 'config.lint.thresholds.noisyToolOutputTokens');
  assertRatio(config.lint.thresholds.oversizedExampleRatio, 'config.lint.thresholds.oversizedExampleRatio');

  assertPositiveInt(
    config.optimize.thresholds.truncateToolOutputTokens,
    'config.optimize.thresholds.truncateToolOutputTokens',
  );
  assertPercent(
    config.optimize.thresholds.trimOversizedExamplesPercent,
    'config.optimize.thresholds.trimOversizedExamplesPercent',
  );

  assertStringArray(config.lint.rules.enabled, 'config.lint.rules.enabled');
  assertStringArray(config.lint.rules.disabled, 'config.lint.rules.disabled');
  assertStringArray(config.optimize.transforms.enabled, 'config.optimize.transforms.enabled');
  assertStringArray(config.optimize.transforms.disabled, 'config.optimize.transforms.disabled');
}

function assertPositiveInt(value: number, key: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
}

function assertRatio(value: number, key: string): void {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`${key} must be a number between 0 and 1`);
  }
}

function assertPercent(value: number, key: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error(`${key} must be an integer between 1 and 100`);
  }
}

function assertStringArray(value: string[], key: string): void {
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) {
    throw new Error(`${key} must be an array of strings`);
  }
}

function assertKnownIds(ids: string[], knownIds: readonly string[] | undefined, key: string): void {
  if (!knownIds) return;

  const known = new Set(knownIds);
  const unknown = ids.filter(id => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`${key} contains unknown id${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`);
  }
}
