import { CharTokenizer } from './char-tokenizer.js';
import { O200kBaseTokenizer } from './o200k-base-tokenizer.js';
import type { TokenizerFactoryConfig, TokenizerSelection } from './types.js';

export function createTokenizer(config: TokenizerFactoryConfig = {}): TokenizerSelection {
  const id = config.default ?? 'char';

  switch (id) {
    case 'char':
      return {
        id,
        tokenizer: new CharTokenizer(config.char?.charsPerToken),
      };
    case 'o200k_base':
      return {
        id,
        tokenizer: new O200kBaseTokenizer(),
      };
    default:
      throw new Error(`Unknown tokenizer id: ${String(id)}`);
  }
}
