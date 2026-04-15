import type {
  OptimizationResult,
  OptimizationChange,
  OptimizeTransformSelection,
} from '@context-compiler/core';

const HR = '─'.repeat(52);

export type OptimizeRenderOptions = {
  dryRun?: boolean;
  wroteFile?: boolean;
  canWrite?: boolean;
  diff?: boolean;
  showOptimizedContent?: boolean;
  command?: 'optimize' | 'compact';
};

/**
 * Human-readable terminal output for the optimize command.
 */
export function renderOptimizeText(
  result: OptimizationResult,
  options: OptimizeRenderOptions = {},
): string {
  const lines: string[] = [];
  const command = options.command ?? 'optimize';
  const title = command === 'compact' ? 'Compact' : 'Optimize';

  lines.push(`\n${title}: ${result.path}`);
  lines.push(HR);
  if (result.tokenizer) {
    lines.push(`Tokenizer: ${result.tokenizer.id}`);
  }
  const transformSelectionLine = formatTransformSelection(result.transformSelection);
  if (transformSelectionLine) {
    lines.push(transformSelectionLine);
  }

  if (result.appliedChanges.length === 0) {
    lines.push('No deterministic compaction found.');
    lines.push(`Tokens : ${result.originalTokens}`);
    lines.push(
      'Current transforms focus on duplicate blocks, repeated formatting rules, oversized examples, large tool output, and repeated exact sentences inside a block.',
    );
    if (options.showOptimizedContent) {
      lines.push('');
      lines.push('Compacted text:');
      lines.push(result.optimizedContent);
    }
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
    if (options.diff) {
      renderChangeDiffText(lines, change);
    } else {
      renderChangeText(lines, change);
    }
  }

  if (options.showOptimizedContent) {
    lines.push('Compacted text:');
    lines.push(result.optimizedContent);
    lines.push('');
  }

  if (options.wroteFile) {
    lines.push(`File written: ${result.path}`);
  } else if (options.dryRun) {
    if (command === 'compact') {
      lines.push('Preview only. File not written.');
    } else {
      lines.push(options.canWrite === false ? 'File not written.' : 'File not written. Use --write to apply changes.');
    }
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

function renderChangeDiffText(lines: string[], change: OptimizationChange): void {
  const blockLabel = change.blockIds.join(', ');
  const delta = change.tokenDelta >= 0 ? `+${change.tokenDelta}` : String(change.tokenDelta);
  lines.push(`  ${change.transformId} [${blockLabel}] (${delta} tok)`);
  lines.push(`    before: "${preview(change.before, 96)}"`);
  lines.push(`    after:  "${change.after === undefined ? '<removed>' : preview(change.after, 96)}"`);
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

export function formatTransformSelection(selection?: OptimizeTransformSelection): string | undefined {
  if (!selection || selection.mode === 'default') return undefined;
  const requested = selection.requestedIds?.join(', ') ?? '';
  return `Transforms: ${selection.mode} ${requested}`;
}
