import type { AnalysisReport, AnalysisIssue } from '@context-compiler/core';
import type { LintResult } from '@context-compiler/rules';
import { createStyler } from './style.js';

const SEVERITY_ICON: Record<string, string> = {
  error: '✗',
  warning: '!',
  info: 'i',
};

/**
 * Human-readable terminal output for the lint command.
 * Analysis warnings and lint issues are shown as distinct labeled sections.
 */
export function renderLintText(
  report: AnalysisReport,
  result: LintResult,
  options: { useColor?: boolean } = {},
): string {
  const lines: string[] = [];
  const style = createStyler({ useColor: options.useColor });
  const hr = '─'.repeat(52);

  lines.push(`\n${style.heading(`Lint: ${report.path}`)}`);
  lines.push(style.muted(hr));
  lines.push(`Result : ${result.issues.length} lint issue${result.issues.length === 1 ? '' : 's'}, ${report.issues.length} analysis warning${report.issues.length === 1 ? '' : 's'}.`);
  lines.push(`Tokens : ${report.totalTokens}  Blocks: ${report.totalBlocks}`);
  if (report.tokenizer) {
    lines.push(`Tokenizer: ${report.tokenizer.id}`);
  }
  lines.push(`Rules  : ${result.rulesRun.join(', ')}`);

  // --- Analysis warnings ---
  lines.push('');
  lines.push(style.label(`Analysis warnings (${report.issues.length}):`));
  if (report.issues.length === 0) {
    lines.push('  ✓ none');
  } else {
    for (const issue of sortBySeverity(report.issues)) {
      renderIssue(lines, issue);
    }
  }

  // --- Lint issues ---
  lines.push('');
  lines.push(style.label(`Lint issues (${result.issues.length}):`));
  if (result.issues.length === 0) {
    lines.push('  ✓ none');
  } else {
    for (const issue of sortBySeverity(result.issues)) {
      renderIssue(lines, issue);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Machine-readable JSON output for the lint command (--json flag).
 * Analysis warnings and lint issues are kept as separate arrays.
 */
export function renderLintJson(report: AnalysisReport, result: LintResult): string {
  return JSON.stringify(
    {
      path: report.path,
      tokenizer: report.tokenizer,
      totalBlocks: report.totalBlocks,
      totalTokens: report.totalTokens,
      rulesRun: result.rulesRun,
      analysisIssues: report.issues,
      lintIssues: result.issues,
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderIssue(lines: string[], issue: AnalysisIssue): void {
  const icon = SEVERITY_ICON[issue.severity] ?? '?';
  const loc = issue.blockId ? ` [${issue.blockId}]` : '';
  lines.push(`  ${icon}${loc} ${issue.ruleId}`);
  lines.push(`    ${issue.message}`);
  if (issue.suggestion) {
    lines.push(`    → ${issue.suggestion}`);
  }
}

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

function sortBySeverity(issues: AnalysisIssue[]): AnalysisIssue[] {
  return [...issues].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );
}
