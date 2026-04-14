import { describe, it, expect } from 'vitest';
import { CharTokenizer } from './char-tokenizer.js';

describe('CharTokenizer', () => {
  const t = new CharTokenizer();

  it('returns 0 for empty string', () => {
    expect(t.count('')).toBe(0);
  });

  it('counts at ~4 chars per token', () => {
    expect(t.count('1234')).toBe(1);
    expect(t.count('12345678')).toBe(2);
    expect(t.count('123456789')).toBe(3);
  });

  it('encodes to start positions', () => {
    expect(t.encode('12345678')).toEqual([0, 4]);
  });

  it('encodes empty string to []', () => {
    expect(t.encode('')).toEqual([]);
  });

  it('respects custom charsPerToken', () => {
    const t2 = new CharTokenizer(2);
    expect(t2.count('1234')).toBe(2);
    expect(t2.encode('1234')).toEqual([0, 2]);
  });
});
