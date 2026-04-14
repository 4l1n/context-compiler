import type { ITokenizer } from './types.js';

/**
 * Naive char-based tokenizer.
 * Approximates 1 token ≈ 4 characters (GPT rule of thumb).
 * No external deps. Replace with tiktoken when needed.
 */
export class CharTokenizer implements ITokenizer {
  private readonly charsPerToken: number;

  constructor(charsPerToken = 4) {
    this.charsPerToken = charsPerToken;
  }

  count(text: string): number {
    if (text.length === 0) return 0;
    return Math.ceil(text.length / this.charsPerToken);
  }

  encode(text: string): number[] {
    const positions: number[] = [];
    for (let i = 0; i < text.length; i += this.charsPerToken) {
      positions.push(i);
    }
    return positions;
  }
}
