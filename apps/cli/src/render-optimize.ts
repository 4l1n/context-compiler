import type {
  OptimizationResult,
  OptimizationChange,
  OptimizeTransformSelection,
} from '@context-compiler/core';
import { createStyler } from './style.js';

const HR = '─'.repeat(52);

export type OptimizeRenderOptions = {
  dryRun?: boolean;
  wroteFile?: boolean;
  canWrite?: boolean;
  diff?: boolean;
  showOptimizedContent?: boolean;
  command?: 'optimize' | 'compact';
  useColor?: boolean;
};

/**
 * Human-readable terminal output for the optimize command.
 */
export function renderOptimizeText(
  result: OptimizationResult,
  options: OptimizeRenderOptions = {},
): string {
  const lines: string[] = [];
  const style = createStyler({ useColor: options.useColor });
  const command = options.command ?? 'optimize';
  const title = command === 'compact' ? 'Compact' : 'Optimize';

  lines.push(`\n${style.heading(`${title}: ${result.path}`)}`);
  lines.push(style.muted(HR));
  const transformSelectionLine = formatTransformSelection(result.transformSelection);

  if (result.appliedChanges.length === 0) {
    lines.push(style.warning('Result: no deterministic compaction found.'));
    lines.push(`Tokens : ${result.originalTokens}`);
    if (result.tokenizer) {
      lines.push(`Tokenizer: ${result.tokenizer.id}`);
    }
    lines.push(
      'Current transforms focus on duplicate blocks, repeated formatting rules, oversized examples, large tool output, and repeated exact sentences inside a block.',
    );
    if (transformSelectionLine) {
      lines.push(transformSelectionLine);
    }
    if (options.showOptimizedContent) {
      lines.push('');
      lines.push(style.label('Result text:'));
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
    style.success(
      command === 'compact'
        ? `Result: compacted with ${result.appliedChanges.length} change${result.appliedChanges.length === 1 ? '' : 's'}.`
        : `Result: ${result.appliedChanges.length} optimization change${result.appliedChanges.length === 1 ? '' : 's'} found.`,
    ),
  );
  lines.push(
    `Tokens : ${result.originalTokens} → ${result.optimizedTokens}` +
      `  (${savingsSign}${savingsAbs}, ${savingsSign}${Math.abs(savingsPct)}%)`,
  );
  if (result.tokenizer) {
    lines.push(`Tokenizer: ${result.tokenizer.id}`);
  }
  if (transformSelectionLine) {
    lines.push(transformSelectionLine);
  }
  lines.push('');

  lines.push(style.label(options.diff ? 'Diff summary:' : 'Applied transforms:'));
  for (const change of result.appliedChanges) {
    if (options.diff) {
      renderChangeDiffText(lines, change);
    } else {
      renderChangeText(lines, change);
    }
  }

  if (options.showOptimizedContent) {
    lines.push(style.label('Result text:'));
    lines.push(result.optimizedContent);
    lines.push('');
  }

  if (options.wroteFile) {
    lines.push(`File written: ${result.path}`);
  } else if (options.dryRun) {
    if (command === 'compact') {
      lines.push(style.muted('Preview only. File not written.'));
    } else {
      lines.push(
        style.muted(
          options.canWrite === false ? 'File not written.' : 'File not written. Use --write to apply changes.',
        ),
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}

function renderChangeText(lines: string[], change: OptimizationChange): void {
  const blockLabel = change.blockIds.join(', ');
  lines.push(`  - ${change.transformId} [${blockLabel}]`);
  lines.push(`    ${change.reason}`);
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
