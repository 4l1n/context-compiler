import type { BlockMetadata } from './types.js';

export const PROTECT_START_MARKER = '<!-- context-compiler: protect:start -->';
export const PROTECT_END_MARKER = '<!-- context-compiler: protect:end -->';

export function isProtectedBlock(block: { metadata?: BlockMetadata }): boolean {
  return block.metadata?.protected === true;
}
