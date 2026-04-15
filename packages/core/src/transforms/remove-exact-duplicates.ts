import type { ITransform, TransformContext, TransformResult } from './types.js';
import type { OptimizationChange } from '../types.js';
import { isProtectedBlock } from '../protection.js';

/**
 * remove-exact-duplicates
 *
 * Operates at block level only (not line level).
 * When two or more blocks have identical trimmed content, all occurrences
 * after the first are removed.
 * Comparison is case-sensitive exact match on trimmed content.
 */
export const removeExactDuplicates: ITransform = {
  id: 'remove-exact-duplicates',
  description: 'Removes blocks whose trimmed content is identical to an earlier block',

  apply({ blocks, tokenizer }: TransformContext): TransformResult {
    const seen = new Map<string, string>(); // normalized content → first block id
    const changes: OptimizationChange[] = [];
    const kept: typeof blocks = [];

    for (const block of blocks) {
      if (isProtectedBlock(block)) {
        kept.push(block);
        continue;
      }

      const key = block.content.trim();
      const firstId = seen.get(key);

      if (firstId !== undefined) {
        changes.push({
          type: 'remove',
          transformId: 'remove-exact-duplicates',
          blockIds: [firstId, block.id],
          primaryBlockId: block.id,
          before: block.content,
          reason: `Exact duplicate of ${firstId}`,
          tokenDelta: -tokenizer.count(block.content),
        });
      } else {
        seen.set(key, block.id);
        kept.push(block);
      }
    }

    return { blocks: kept, changes };
  },
};
