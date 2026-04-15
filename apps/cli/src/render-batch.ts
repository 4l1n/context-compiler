import type { OptimizationChange } from '@context-compiler/core';
import type {
  AnalyzeDirectoryResult,
  DirectoryFilters,
  LintDirectoryResult,
  OptimizeDirectoryResult,
} from './batch.js';
import { formatTransformSelection } from './render-optimize.js';
import { createStyler } from './style.js';

const HR = '─'.repeat(52);

export function renderAnalyzeDirectoryText(
  result: AnalyzeDirectoryResult,
  options: { useColor?: boolean } = {},
): string {
  const lines: string[] = [];
  const style = createStyler({ useColor: options.useColor });
  lines.push(`\n${style.heading(`Analysis: ${result.path}`)}`);
  lines.push(style.muted(HR));
  lines.push(`Result: analyzed ${result.summary.filesProcessed} file${result.summary.filesProcessed === 1 ? '' : 's'}.`);
  lines.push(`Totals: ${result.summary.totalTokens} tokens, ${result.summary.totalBlocks} blocks, ${result.summary.warningCount} warnings.`);
  const filterLine = formatActiveFilters(result.filters);
  if (filterLine) lines.push(filterLine);
  lines.push('');
  lines.push(style.label('Per-file results:'));

  for (const report of result.files) {
    lines.push(
      `  ${report.path}  blocks: ${report.totalBlocks}  tokens: ${report.totalTokens}  warnings: ${report.issues.length}`,
    );
  }

  lines.push('');
  lines.push(style.label('Aggregate summary:'));
  lines.push(`  Files processed: ${result.summary.filesProcessed}`);
  lines.push(`  Total blocks: ${result.summary.totalBlocks}`);
  lines.push(`  Total tokens: ${result.summary.totalTokens}`);
  lines.push(`  Warning count: ${result.summary.warningCount}`);
  lines.push('');
  return lines.join('\n');
}

export function renderAnalyzeDirectoryJson(result: AnalyzeDirectoryResult): string {
  return JSON.stringify(result, null, 2);
}

export function renderLintDirectoryText(
  result: LintDirectoryResult,
  options: { useColor?: boolean } = {},
): string {
  const lines: string[] = [];
  const style = createStyler({ useColor: options.useColor });
  lines.push(`\n${style.heading(`Lint: ${result.path}`)}`);
  lines.push(style.muted(HR));
  lines.push(`Result: ${result.summary.totalIssues} total issue${result.summary.totalIssues === 1 ? '' : 's'}.`);
  const filterLine = formatActiveFilters(result.filters);
  if (filterLine) lines.push(filterLine);
  lines.push('');
  lines.push(style.label('Per-file results:'));

  for (const file of result.files) {
    const analysisCount = file.report.issues.length;
    const lintCount = file.result.issues.length;
    lines.push(`  ${file.path}  analysis warnings: ${analysisCount}  lint issues: ${lintCount}`);

    const issueLabels = [...file.report.issues, ...file.result.issues]
      .map(issue => `${issue.severity}:${issue.ruleId}${issue.blockId ? ` [${issue.blockId}]` : ''}`)
      .join(', ');
    if (issueLabels) {
      lines.push(`    ${issueLabels}`);
    }
  }

  lines.push('');
  lines.push(style.label('Aggregate summary:'));
  lines.push(`  Files processed: ${result.summary.filesProcessed}`);
  lines.push(`  Total issues: ${result.summary.totalIssues}`);
  lines.push(
    `  Issues by severity: error ${result.summary.issuesBySeverity.error}, warning ${result.summary.issuesBySeverity.warning}, info ${result.summary.issuesBySeverity.info}`,
  );
  lines.push('');
  return lines.join('\n');
}

export function renderLintDirectoryJson(result: LintDirectoryResult): string {
  return JSON.stringify(result, null, 2);
}

export function renderOptimizeDirectoryText(
  result: OptimizeDirectoryResult,
  options: { write?: boolean; diff?: boolean; command?: 'optimize' | 'compact'; useColor?: boolean } = {},
): string {
  const lines: string[] = [];
  const style = createStyler({ useColor: options.useColor });
  const command = options.command ?? 'optimize';
  const title = command === 'compact' ? 'Compact' : 'Optimize';
  lines.push(`\n${style.heading(`${title}: ${result.path}`)}`);
  lines.push(style.muted(HR));
  lines.push(
    `Result: ${result.summary.filesChanged}/${result.summary.filesProcessed} files changed, ${result.summary.totalSavings} tokens saved.`,
  );
  const filterLine = formatActiveFilters(result.filters);
  if (filterLine) lines.push(filterLine);
  const transformSelectionLine = formatTransformSelection(result.transformSelection);
  if (transformSelectionLine) {
    lines.push(transformSelectionLine);
  }
  lines.push('');
  lines.push(style.label('Per-file results:'));

  for (const file of result.files) {
    if (file.appliedChanges.length === 0) {
      if (!options.diff) {
        lines.push(`  ${file.path}  no changes  tokens: ${file.originalTokens}`);
      }
      continue;
    }

    lines.push(
      `  ${file.path}  changes: ${file.appliedChanges.length}  tokens: ${file.originalTokens} -> ${file.optimizedTokens} (${formatSavings(file.tokenSavings)})`,
    );

    if (options.diff) {
      for (const change of file.appliedChanges) {
        renderChangeDiff(lines, change);
      }
    }
  }

  lines.push('');
  lines.push(style.label('Aggregate summary:'));
  lines.push(`  Files processed: ${result.summary.filesProcessed}`);
  lines.push(`  Files changed: ${result.summary.filesChanged}`);
  lines.push(`  Original tokens: ${result.summary.totalOriginalTokens}`);
  lines.push(`  Optimized tokens: ${result.summary.totalOptimizedTokens}`);
  lines.push(`  Total savings: ${result.summary.totalSavings}`);
  lines.push(`  Changes applied: ${result.summary.totalChangesApplied}`);

  if (options.write) {
    lines.push(`  Files written: ${result.summary.filesWritten}`);
  } else {
    lines.push(
      command === 'compact'
        ? `  ${style.muted('Preview only. Files were not written.')}`
        : `  ${style.muted('Files not written. Use --write to apply directory changes.')}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function renderOptimizeDirectoryJson(result: OptimizeDirectoryResult): string {
  return JSON.stringify(result, null, 2);
}

function renderChangeDiff(lines: string[], change: OptimizationChange): void {
  const blockLabel = change.blockIds.join(', ');
  const delta = change.tokenDelta >= 0 ? `+${change.tokenDelta}` : String(change.tokenDelta);
  lines.push(`    ${change.transformId} [${blockLabel}] (${delta} tok)`);
  lines.push(`      before: "${preview(change.before, 96)}"`);
  lines.push(`      after:  "${change.after === undefined ? '<removed>' : preview(change.after, 96)}"`);
}

function preview(text: string, maxLen = 72): string {
  const oneLine = text.replace(/\n/g, '↵ ').trim();
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '…' : oneLine;
}

function formatSavings(value: number): string {
  if (value === 0) return '0';
  return value > 0 ? `-${value}` : `+${Math.abs(value)}`;
}

/**
 * Returns a one-line filter summary or empty string if no filters are active.
 * Format: "Filters: include [a, b] exclude [c]"
 * Omits the include/exclude part when the corresponding list is empty.
 */
function formatActiveFilters(filters: DirectoryFilters | undefined): string {
  if (!filters) return '';
  const parts: string[] = [];
  if (filters.include.length > 0) parts.push(`include [${filters.include.join(', ')}]`);
  if (filters.exclude.length > 0) parts.push(`exclude [${filters.exclude.join(', ')}]`);
  if (parts.length === 0) return '';
  return `Filters: ${parts.join(' ')}`;
}
