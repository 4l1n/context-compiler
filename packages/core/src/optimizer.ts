import type { AnalyzedBlock, ITokenizer, OptimizationChange, OptimizationResult } from './types.js';
import type { AnalysisReport } from './types.js';
import type { ITransform, TransformContext } from './transforms/types.js';
import { isProtectedBlock } from './protection.js';

// ---------------------------------------------------------------------------
// Content assembly
// ---------------------------------------------------------------------------

/**
 * Reassembles content from the final block list after transforms have run.
 *
 * Strategy (conservative):
 *  - Iterates originalBlocks in their original order.
 *  - Removed blocks (absent from finalBlockMap) are skipped.
 *  - Unchanged blocks (same content as original) are taken verbatim.
 *  - Replaced blocks (different content) use the new content.
 *  - Surviving blocks are joined with '\n\n'.
 *
 * Trade-off: if the original used separators other than '\n\n', those are
 * normalised to '\n\n'. Acceptable for prompt optimisation in v1.
 */
function assembleContent(
  originalBlocks: AnalyzedBlock[],
  finalBlocks: AnalyzedBlock[],
): string {
  const finalMap = new Map(finalBlocks.map(b => [b.id, b]));

  const parts: string[] = [];
  for (const orig of originalBlocks) {
    const final = finalMap.get(orig.id);
    if (!final) continue; // removed
    parts.push(final.content === orig.content ? orig.content : final.content);
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Pure optimization pipeline — no I/O.
 *
 * Callers are responsible for loading the file and building the report:
 *
 *   const content = await loadFile(path);
 *   const report  = buildReport(path, content, ext, tokenizer);
 *   const result  = runOptimize(path, content, report, DEFAULT_TRANSFORMS, tokenizer);
 */
export function runOptimize(
  path: string,
  originalContent: string,
  report: AnalysisReport,
  transforms: ITransform[],
  tokenizer: ITokenizer,
): OptimizationResult {
  const originalTokens = report.totalTokens;
  const originalBlocks = report.blocks;

  // Run transforms sequentially; each receives the output of the previous.
  let currentBlocks: AnalyzedBlock[] = originalBlocks;
  let currentTotalTokens = originalTokens;
  const allChanges: OptimizationChange[] = [];

  for (const transform of transforms) {
    const context: TransformContext = {
      blocks: currentBlocks,
      totalTokens: currentTotalTokens,
      tokenizer,
    };
    const result = transform.apply(context);
    assertProtectedBlocksPreserved(currentBlocks, result.blocks, transform.id);
    allChanges.push(...result.changes);
    currentBlocks = result.blocks;
    currentTotalTokens = currentBlocks.reduce((s, b) => s + b.tokenCount, 0);
  }

  const optimizedContent =
    allChanges.length === 0 ? originalContent : assembleContent(originalBlocks, currentBlocks);

  // Coherence validation — hard failures only.
  if (optimizedContent.trim() === '') {
    throw new Error('runOptimize: all blocks were removed — result would be empty');
  }
  if (currentBlocks.length === 0) {
    throw new Error('runOptimize: no blocks survived the transform pipeline');
  }

  const optimizedTokens = currentBlocks.reduce((sum, block) => sum + tokenizer.count(block.content), 0);
  const tokenSavings = originalTokens - optimizedTokens;

  return {
    path,
    originalContent,
    optimizedContent,
    originalTokens,
    optimizedTokens,
    tokenSavings,
    appliedChanges: allChanges,
  };
}

function assertProtectedBlocksPreserved(
  beforeBlocks: AnalyzedBlock[],
  afterBlocks: AnalyzedBlock[],
  transformId: string,
): void {
  const afterById = new Map(afterBlocks.map(block => [block.id, block]));

  for (const before of beforeBlocks) {
    if (!isProtectedBlock(before)) continue;

    const after = afterById.get(before.id);
    if (!after) {
      throw new Error(`runOptimize: transform "${transformId}" removed protected block ${before.id}`);
    }

    if (!isProtectedBlock(after) || after.content !== before.content) {
      throw new Error(`runOptimize: transform "${transformId}" modified protected block ${before.id}`);
    }
  }
}
