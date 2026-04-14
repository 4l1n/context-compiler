export interface ITokenizer {
  /** Count tokens in a string. */
  count(text: string): number;
  /** Encode text to token positions. */
  encode(text: string): number[];
}
