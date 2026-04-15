import { Tiktoken } from 'js-tiktoken/lite';
import o200kBase from 'js-tiktoken/ranks/o200k_base';
import type { ITokenizer } from './types.js';

/**
 * Real BPE tokenizer for the o200k_base model-family encoding.
 */
export class O200kBaseTokenizer implements ITokenizer {
  private readonly encoding = new Tiktoken(o200kBase);

  count(text: string): number {
    return this.encode(text).length;
  }

  encode(text: string): number[] {
    return Array.from(this.encoding.encode(text));
  }
}
