import type { OptimizationResult, OptimizationChange } from '@context-compiler/core';

const HR = '─'.repeat(52);

export type OptimizeRenderOptions = {
  dryRun?: boolean;
  wroteFile?: boolean;
};

/**
 * Human-readable terminal output for the optimize command.
 */
export function renderOptimizeText(
  result: OptimizationResult,
  options: OptimizeRenderOptions = {},
): string {
  const lines: string[] = [];

  lines.push(`\nOptimize: ${result.path}`);
  lines.push(HR);

  if (result.appliedChanges.length === 0) {
    lines.push(`No changes. Tokens: ${result.originalTokens}`);
    lines.push('');
    return lines.join('\n');
  }

  const savingsPct =
    result.originalTokens > 0
      ? Math.round((result.tokenSavings / result.originalTokens) * 100)
      : 0;
  const savingsSign = result.tokenSavings >= 0 ? '−' : '+';
  const savingsAbs = Math.abs(result.tokenSavings);

  lines.push(
    `Tokens : ${result.originalTokens} → ${result.optimizedTokens}` +
      `  (${savingsSign}${savingsAbs}, ${savingsSign}${Math.abs(savingsPct)}%)`,
  );
  lines.push(`Changes: ${result.appliedChanges.length} applied`);
  lines.push('');

  for (const change of result.appliedChanges) {
    renderChangeText(lines, change);
  }

  if (options.wroteFile) {
    lines.push(`File written: ${result.path}`);
  } else if (options.dryRun) {
    lines.push('File not written. Use --write to apply changes.');
  }

  lines.push('');
  return lines.join('\n');
}

function renderChangeText(lines: string[], change: OptimizationChange): void {
  const blockLabel = change.blockIds.join(', ');
  lines.push(`  ✓ [${blockLabel}] ${change.transformId}`);
  lines.push(`    ${change.reason}`);

  const beforePreview = preview(change.before);
  lines.push(`    before: "${beforePreview}"`);

  if (change.type === 'replace' && change.after !== undefined) {
    const afterPreview = preview(change.after);
    lines.push(`    after:  "${afterPreview}"`);
  }
  lines.push('');
}

function preview(text: string, maxLen = 72): string {
  const oneLine = text.replace(/\n/g, '↵ ').trim();
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '…' : oneLine;
}

/**
 * Machine-readable JSON output for the optimize command (--json flag).
 */
export function renderOptimizeJson(result: OptimizationResult): string {
  return JSON.stringify(result, null, 2);
}
