import { describe, expect, it } from 'vitest';
import { CharTokenizer } from './char-tokenizer.js';
import { createTokenizer } from './factory.js';
import { O200kBaseTokenizer } from './o200k-base-tokenizer.js';
import type { TokenizerFactoryConfig } from './types.js';

describe('createTokenizer', () => {
  it('returns char by default', () => {
    const selection = createTokenizer();
    expect(selection.id).toBe('char');
    expect(selection.tokenizer).toBeInstanceOf(CharTokenizer);
  });

  it('passes char options through', () => {
    const selection = createTokenizer({ default: 'char', char: { charsPerToken: 2 } });
    expect(selection.tokenizer.count('1234')).toBe(2);
  });

  it('returns o200k_base when configured', () => {
    const selection = createTokenizer({ default: 'o200k_base' });
    expect(selection.id).toBe('o200k_base');
    expect(selection.tokenizer).toBeInstanceOf(O200kBaseTokenizer);
  });

  it('throws on unknown tokenizer ids', () => {
    const config = { default: 'missing-tokenizer' } as unknown as TokenizerFactoryConfig;
    expect(() => createTokenizer(config)).toThrow('Unknown tokenizer id: missing-tokenizer');
  });
});
