import { isProtectedBlock } from '@context-compiler/core';
import type { AnalysisReport } from '@context-compiler/core';
import { createStyler } from './style.js';

const SEVERITY_ICON: Record<string, string> = {
  error: '✗',
  warning: '!',
  info: 'i',
};

export type AnalyzeRenderOptions = {
  useColor?: boolean;
  compactHint?: string;
};

/**
 * Human-readable terminal output.
 */
export function renderText(report: AnalysisReport, options: AnalyzeRenderOptions = {}): string {
  const lines: string[] = [];
  const style = createStyler({ useColor: options.useColor });
  const hr = '─'.repeat(52);

  lines.push(`\n${style.heading(`Analysis: ${report.path}`)}`);
  lines.push(style.muted(hr));
  lines.push(`Tokens : ${report.totalTokens}${report.tokenizer ? `  (${report.tokenizer.id})` : ''}`);
  lines.push(`Blocks : ${report.totalBlocks}  Warnings: ${report.issues.length}`);

  if (report.blocks.length > 0) {
    lines.push('');
    lines.push(style.label('Details:'));
    for (const block of report.blocks) {
      const preview = block.content.slice(0, 60).replace(/\n/g, ' ');
      const ellipsis = block.content.length > 60 ? '…' : '';
      const type = block.type.padEnd(16);
      const protectedLabel = isProtectedBlock(block) ? ' protected' : '';
      const tok = String(block.tokenCount).padStart(5);
      const pct = String(block.tokenPercent).padStart(3);
      lines.push(`[${block.id}] ${type}${protectedLabel} ${tok} tok  ${pct}%`);
      lines.push(`  "${preview}${ellipsis}"`);
    }
  }

  if (report.issues.length > 0) {
    lines.push('');
    lines.push(style.label('Warning details:'));
    for (const issue of report.issues) {
      const icon = SEVERITY_ICON[issue.severity] ?? '?';
      const loc = issue.blockId ? ` [${issue.blockId}]` : '';
      lines.push(`  ${icon}${loc} ${issue.ruleId}`);
      lines.push(`    ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`    → ${issue.suggestion}`);
      }
    }
  }

  if (options.compactHint) {
    lines.push('');
    lines.push(style.label('Next step:'));
    lines.push(`  Hint: ${options.compactHint}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Machine-readable JSON output (--json flag).
 */
export function renderJson(report: AnalysisReport): string {
  return JSON.stringify(report, null, 2);
}
