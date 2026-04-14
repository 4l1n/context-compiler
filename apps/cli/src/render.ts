import type { AnalysisReport } from '@context-compiler/core';

const SEVERITY_ICON: Record<string, string> = {
  error: '✗',
  warning: '!',
  info: 'i',
};

/**
 * Human-readable terminal output.
 */
export function renderText(report: AnalysisReport): string {
  const lines: string[] = [];
  const hr = '─'.repeat(52);

  lines.push(`\nAnalysis: ${report.path}`);
  lines.push(hr);
  lines.push(`Blocks : ${report.totalBlocks}`);
  lines.push(`Tokens : ${report.totalTokens}`);

  if (report.blocks.length > 0) {
    lines.push('');
    for (const block of report.blocks) {
      const preview = block.content.slice(0, 60).replace(/\n/g, ' ');
      const ellipsis = block.content.length > 60 ? '…' : '';
      const type = block.type.padEnd(16);
      const tok = String(block.tokenCount).padStart(5);
      const pct = String(block.tokenPercent).padStart(3);
      lines.push(`[${block.id}] ${type} ${tok} tok  ${pct}%`);
      lines.push(`  "${preview}${ellipsis}"`);
    }
  }

  if (report.issues.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const issue of report.issues) {
      const icon = SEVERITY_ICON[issue.severity] ?? '?';
      const loc = issue.blockId ? ` [${issue.blockId}]` : '';
      lines.push(`  ${icon}${loc} ${issue.message}`);
    }
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
