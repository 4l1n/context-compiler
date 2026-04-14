import type { AnalyzedBlock, ITokenizer, OptimizationChange } from '../types.js';

export type TransformContext = {
  blocks: AnalyzedBlock[];
  totalTokens: number;
  tokenizer: ITokenizer;
};

export type TransformResult = {
  /** New block array — never mutates input. Removed blocks are absent. */
  blocks: AnalyzedBlock[];
  changes: OptimizationChange[];
};

export interface ITransform {
  readonly id: string;
  readonly description: string;
  apply(context: TransformContext): TransformResult;
}
