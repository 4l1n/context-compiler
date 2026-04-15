import { describe, expect, it } from 'vitest';
import { O200kBaseTokenizer } from './o200k-base-tokenizer.js';

describe('O200kBaseTokenizer', () => {
  const tokenizer = new O200kBaseTokenizer();

  it('returns 0 for empty string', () => {
    expect(tokenizer.count('')).toBe(0);
  });

  it('counts hello world as two tokens', () => {
    expect(tokenizer.count('hello world')).toBe(2);
  });

  it('encode length matches count', () => {
    const text = 'Use concise markdown.';
    expect(tokenizer.encode(text)).toHaveLength(tokenizer.count(text));
  });
});
