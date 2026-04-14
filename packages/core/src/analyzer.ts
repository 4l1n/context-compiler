import { extname } from 'node:path';
import { loadFile } from './loader.js';
import { parseBlocks } from './parser.js';
import { classifyBlock } from './classifier.js';
import { checkWarnings } from './warnings.js';
import type { WarningThresholds } from './warnings.js';
import type { ITokenizer, AnalysisReport, AnalyzedBlock } from './types.js';

export type BuildReportOptions = {
  warningThresholds?: WarningThresholds;
};

/**
 * Pure analysis: no I/O.
 * Takes pre-loaded content and returns a complete AnalysisReport.
 * Useful for testing without touching the filesystem.
 */
export function buildReport(
  filePath: string,
  content: string,
  ext: string,
  tokenizer: ITokenizer,
  options: BuildReportOptions = {},
): AnalysisReport {
  const rawBlocks = parseBlocks(content, ext);
  const tokenCounts = rawBlocks.map(b => tokenizer.count(b.content));
  const totalTokens = tokenCounts.reduce((sum, n) => sum + n, 0);

  const blocks: AnalyzedBlock[] = rawBlocks.map((block, i) => {
    const count = tokenCounts[i] ?? 0;
    return {
      id: block.id,
      content: block.content,
      type: classifyBlock(block.content),
      tokenCount: count,
      tokenPercent: totalTokens > 0 ? Math.round((count / totalTokens) * 100) : 0,
    };
  });

  return {
    path: filePath,
    blocks,
    issues: checkWarnings(blocks, options.warningThresholds),
    totalBlocks: blocks.length,
    totalTokens,
    createdAt: new Date(),
  };
}

/**
 * Full analysis: reads from the filesystem, then calls buildReport.
 */
export async function analyze(
  filePath: string,
  tokenizer: ITokenizer,
  options: BuildReportOptions = {},
): Promise<AnalysisReport> {
  const ext = extname(filePath).toLowerCase();
  const content = await loadFile(filePath);
  return buildReport(filePath, content, ext, tokenizer, options);
}
