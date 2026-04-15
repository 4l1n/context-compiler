import { writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { loadFile, buildReport, runOptimize, buildTransforms } from '@context-compiler/core';
import type {
  AnalysisIssue,
  AnalysisReport,
  OptimizationResult,
  OptimizeTransformSelection,
} from '@context-compiler/core';
import { buildRules, runLint } from '@context-compiler/rules';
import type { LintResult } from '@context-compiler/rules';
import { createTokenizer } from '@context-compiler/tokenizers';
import type { ContextCompilerConfig } from '@context-compiler/config';
import { discoverSupportedFiles } from './discovery.js';
import type { OptimizeControls } from './optimize-controls.js';
import { filterFiles, hasActiveFilters } from './directory-filters.js';
import type { DirectoryFilters } from './directory-filters.js';

export type { DirectoryFilters };

export type AnalyzeDirectorySummary = {
  filesProcessed: number;
  totalBlocks: number;
  totalTokens: number;
  warningCount: number;
};

export type AnalyzeDirectoryResult = {
  path: string;
  kind: 'directory';
  filters?: DirectoryFilters;
  files: AnalysisReport[];
  summary: AnalyzeDirectorySummary;
};

export type LintDirectoryFileResult = {
  path: string;
  report: AnalysisReport;
  result: LintResult;
};

export type IssueSeverityCounts = {
  error: number;
  warning: number;
  info: number;
};

export type LintDirectorySummary = {
  filesProcessed: number;
  totalIssues: number;
  issuesBySeverity: IssueSeverityCounts;
};

export type LintDirectoryResult = {
  path: string;
  kind: 'directory';
  filters?: DirectoryFilters;
  files: LintDirectoryFileResult[];
  summary: LintDirectorySummary;
};

export type OptimizeDirectorySummary = {
  filesProcessed: number;
  filesChanged: number;
  filesWritten: number;
  totalOriginalTokens: number;
  totalOptimizedTokens: number;
  totalSavings: number;
  totalChangesApplied: number;
};

export type OptimizeDirectoryResult = {
  path: string;
  kind: 'directory';
  filters?: DirectoryFilters;
  transformSelection?: OptimizeTransformSelection;
  files: OptimizationResult[];
  summary: OptimizeDirectorySummary;
};

export type LoadedFileInput = {
  path: string;
  content: string;
  ext: string;
};

export function analyzeInput(input: LoadedFileInput, config: ContextCompilerConfig): AnalysisReport {
  const tokenizer = createTokenizer(config.tokenizer);
  return buildReport(input.path, input.content, input.ext, tokenizer.tokenizer, {
    tokenizer: { id: tokenizer.id },
    warningThresholds: config.lint.warnings,
  });
}

export async function analyzeFilePath(filePath: string, config: ContextCompilerConfig): Promise<AnalysisReport> {
  return analyzeInput(await loadFileInput(filePath), config);
}

export async function analyzeDirectory(
  directoryPath: string,
  config: ContextCompilerConfig,
  options: { filters?: DirectoryFilters } = {},
): Promise<AnalyzeDirectoryResult> {
  const discovered = await discoverSupportedFiles(directoryPath);
  const filters = options.filters ?? { include: [], exclude: [] };
  const filePaths = hasActiveFilters(filters)
    ? filterFiles(discovered, directoryPath, filters)
    : discovered;
  const files: AnalysisReport[] = [];

  for (const filePath of filePaths) {
    files.push(await runForFile(filePath, 'analyze', () => analyzeFilePath(filePath, config)));
  }

  return {
    path: directoryPath,
    kind: 'directory',
    ...(hasActiveFilters(filters) ? { filters } : {}),
    files,
    summary: {
      filesProcessed: files.length,
      totalBlocks: files.reduce((sum, report) => sum + report.totalBlocks, 0),
      totalTokens: files.reduce((sum, report) => sum + report.totalTokens, 0),
      warningCount: files.reduce((sum, report) => sum + report.issues.length, 0),
    },
  };
}

export function lintReport(report: AnalysisReport, config: ContextCompilerConfig): LintResult {
  const rules = buildRules({
    enabledRuleIds: config.lint.rules.enabled,
    disabledRuleIds: config.lint.rules.disabled,
    thresholds: {
      noisyToolOutputTokens: config.lint.thresholds.noisyToolOutputTokens,
      oversizedExampleRatio: config.lint.thresholds.oversizedExampleRatio,
    },
  });

  return runLint(rules, {
    path: report.path,
    blocks: report.blocks,
    totalTokens: report.totalTokens,
  });
}

export async function lintDirectory(
  directoryPath: string,
  config: ContextCompilerConfig,
  options: { filters?: DirectoryFilters } = {},
): Promise<LintDirectoryResult> {
  const discovered = await discoverSupportedFiles(directoryPath);
  const filters = options.filters ?? { include: [], exclude: [] };
  const filePaths = hasActiveFilters(filters)
    ? filterFiles(discovered, directoryPath, filters)
    : discovered;
  const files: LintDirectoryFileResult[] = [];

  for (const filePath of filePaths) {
    files.push(
      await runForFile(filePath, 'lint', async () => {
        const report = await analyzeFilePath(filePath, config);
        return {
          path: filePath,
          report,
          result: lintReport(report, config),
        };
      }),
    );
  }

  const allIssues = files.flatMap(file => [...file.report.issues, ...file.result.issues]);

  return {
    path: directoryPath,
    kind: 'directory',
    ...(hasActiveFilters(filters) ? { filters } : {}),
    files,
    summary: {
      filesProcessed: files.length,
      totalIssues: allIssues.length,
      issuesBySeverity: countIssuesBySeverity(allIssues),
    },
  };
}

export function optimizeInput(
  input: LoadedFileInput,
  config: ContextCompilerConfig,
  controls: OptimizeControls = { mode: 'default' },
): OptimizationResult {
  const tokenizer = createTokenizer(config.tokenizer);
  const report = buildReport(input.path, input.content, input.ext, tokenizer.tokenizer, {
    tokenizer: { id: tokenizer.id },
    warningThresholds: config.lint.warnings,
  });
  const { transforms, transformSelection } = buildOptimizeRuntime(config, controls);

  return {
    ...runOptimize(input.path, input.content, report, transforms, tokenizer.tokenizer),
    transformSelection,
  };
}

export async function optimizeFilePath(
  filePath: string,
  config: ContextCompilerConfig,
  controls: OptimizeControls = { mode: 'default' },
): Promise<OptimizationResult> {
  return optimizeInput(await loadFileInput(filePath), config, controls);
}

export async function optimizeDirectory(
  directoryPath: string,
  config: ContextCompilerConfig,
  options: { write?: boolean; controls?: OptimizeControls; filters?: DirectoryFilters } = {},
): Promise<OptimizeDirectoryResult> {
  const discovered = await discoverSupportedFiles(directoryPath);
  const filters = options.filters ?? { include: [], exclude: [] };
  const filePaths = hasActiveFilters(filters)
    ? filterFiles(discovered, directoryPath, filters)
    : discovered;
  const files: OptimizationResult[] = [];
  const controls = options.controls ?? { mode: 'default' };

  for (const filePath of filePaths) {
    files.push(await runForFile(filePath, 'optimize', () => optimizeFilePath(filePath, config, controls)));
  }

  let filesWritten = 0;
  if (options.write) {
    for (const result of files) {
      if (result.appliedChanges.length === 0) continue;
      try {
        await writeFile(result.path, result.optimizedContent, 'utf8');
        filesWritten++;
      } catch (err) {
        throw new Error(`Failed to write ${result.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    path: directoryPath,
    kind: 'directory',
    ...(hasActiveFilters(filters) ? { filters } : {}),
    transformSelection: files[0]?.transformSelection,
    files,
    summary: {
      filesProcessed: files.length,
      filesChanged: files.filter(result => result.appliedChanges.length > 0).length,
      filesWritten,
      totalOriginalTokens: files.reduce((sum, result) => sum + result.originalTokens, 0),
      totalOptimizedTokens: files.reduce((sum, result) => sum + result.optimizedTokens, 0),
      totalSavings: files.reduce((sum, result) => sum + result.tokenSavings, 0),
      totalChangesApplied: files.reduce((sum, result) => sum + result.appliedChanges.length, 0),
    },
  };
}

function buildOptimizeRuntime(
  config: ContextCompilerConfig,
  controls: OptimizeControls,
): {
  transforms: ReturnType<typeof buildTransforms>;
  transformSelection: OptimizeTransformSelection;
} {
  const enabledTransformIds =
    controls.mode === 'only'
      ? controls.requestedIds
      : controls.mode === 'default'
        ? config.optimize.transforms.enabled
        : [];
  const disabledTransformIds =
    controls.mode === 'except'
      ? controls.requestedIds
      : controls.mode === 'default'
        ? config.optimize.transforms.disabled
        : [];

  const transforms = buildTransforms({
    enabledTransformIds,
    disabledTransformIds,
    thresholds: {
      truncateToolOutputTokens: config.optimize.thresholds.truncateToolOutputTokens,
      trimOversizedExamplesPercent: config.optimize.thresholds.trimOversizedExamplesPercent,
    },
  });

  return {
    transforms,
    transformSelection: {
      mode: controls.mode,
      activeTransformIds: transforms.map(transform => transform.id),
      ...(controls.requestedIds ? { requestedIds: controls.requestedIds } : {}),
    },
  };
}

async function loadFileInput(filePath: string): Promise<LoadedFileInput> {
  return {
    path: filePath,
    content: await loadFile(filePath),
    ext: extname(filePath).toLowerCase(),
  };
}

async function runForFile<T>(filePath: string, command: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(`Failed to ${command} ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function countIssuesBySeverity(issues: AnalysisIssue[]): IssueSeverityCounts {
  return issues.reduce<IssueSeverityCounts>(
    (counts, issue) => {
      counts[issue.severity]++;
      return counts;
    },
    { error: 0, warning: 0, info: 0 },
  );
}
