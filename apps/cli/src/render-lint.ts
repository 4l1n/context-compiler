import type { AnalysisReport, AnalysisIssue } from '@context-compiler/core';
import type { LintResult } from '@context-compiler/rules';

const SEVERITY_ICON: Record<string, string> = {
  error: '✗',
  warning: '!',
  info: 'i',
};

/**
 * Human-readable terminal output for the lint command.
 * Shows analysis warnings + lint issues combined, sorted by severity.
 */
export function renderLintText(report: AnalysisReport, result: LintResult): string {
  const lines: string[] = [];
  const hr = '─'.repeat(52);

  const allIssues = sortBySeverity([...report.issues, ...result.issues]);
  const issueLabel = allIssues.length === 1 ? '1 issue' : `${allIssues.length} issues`;

  lines.push(`\nLint: ${report.path}  — ${issueLabel}`);
  lines.push(hr);
  lines.push(`Rules  : ${result.rulesRun.join(', ')}`);
  lines.push(`Blocks : ${report.totalBlocks}  Tokens: ${report.totalTokens}`);

  if (allIssues.length === 0) {
    lines.push('');
    lines.push('  ✓ No issues found');
  } else {
    lines.push('');
    for (const issue of allIssues) {
      const icon = SEVERITY_ICON[issue.severity] ?? '?';
      const loc = issue.blockId ? ` [${issue.blockId}]` : '';
      const source = result.issues.includes(issue) ? '' : ' (analysis)';
      lines.push(`  ${icon}${loc} ${issue.ruleId}${source}`);
      lines.push(`    ${issue.message}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Machine-readable JSON output for the lint command (--json flag).
 */
export function renderLintJson(report: AnalysisReport, result: LintResult): string {
  return JSON.stringify(
    {
      path: report.path,
      totalBlocks: report.totalBlocks,
      totalTokens: report.totalTokens,
      rulesRun: result.rulesRun,
      analysisIssues: report.issues,
      lintIssues: result.issues,
      allIssues: sortBySeverity([...report.issues, ...result.issues]),
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

function sortBySeverity(issues: AnalysisIssue[]): AnalysisIssue[] {
  return [...issues].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );
}
