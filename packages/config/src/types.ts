export type TokenizerConfig =
  | { type: 'char'; charsPerToken?: number };

export type Config = {
  rules: {
    enabled: string[];
    disabled: string[];
  };
  tokenizer: TokenizerConfig;
  output: {
    format: 'json' | 'text';
  };
};

export const defaultConfig: Config = {
  rules: {
    enabled: [],
    disabled: [],
  },
  tokenizer: {
    type: 'char',
    charsPerToken: 4,
  },
  output: {
    format: 'text',
  },
};
