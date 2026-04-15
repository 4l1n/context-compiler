export interface ITokenizer {
  /** Count tokens in a string. */
  count(text: string): number;
  /** Encode text to tokenizer-specific numeric tokens. */
  encode(text: string): number[];
}

export type TokenizerId = 'char' | 'o200k_base';

export type TokenizerFactoryConfig = {
  default?: TokenizerId;
  char?: {
    charsPerToken?: number;
  };
};

export type TokenizerSelection = {
  id: TokenizerId;
  tokenizer: ITokenizer;
};
