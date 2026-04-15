import { writeFile } from 'node:fs/promises';
import { loadConfig } from '@context-compiler/config';
import { KNOWN_TRANSFORM_IDS } from '@context-compiler/core';
import { KNOWN_RULE_IDS } from '@context-compiler/rules';
import { renderText, renderJson } from './render.js';
import { renderLintText, renderLintJson } from './render-lint.js';
import { renderOptimizeText, renderOptimizeJson } from './render-optimize.js';
import {
  renderAnalyzeDirectoryJson,
  renderAnalyzeDirectoryText,
  renderLintDirectoryJson,
  renderLintDirectoryText,
  renderOptimizeDirectoryJson,
  renderOptimizeDirectoryText,
} from './render-batch.js';
import {
  analyzeDirectory,
  analyzeInput,
  countIssuesBySeverity,
  lintDirectory,
  lintReport,
  optimizeDirectory,
  optimizeInput,
} from './batch.js';
import { isFileLikeInput, isPathInput, resolveCliInput } from './input.js';
import { parseOptimizeControls } from './optimize-controls.js';
import { parseDirectoryFilters } from './directory-filters.js';
import {
  CheckFailureError,
  assertLintPass,
  assertOptimizeNoChanges,
  assertWithinBudget,
  parseFailOnSeverity,
  parseMaxTokens,
} from './check.js';

function printHelp(): void {
  console.log(`context-compiler — analyze and optimize LLM prompts

Simple mode (default: analyze):
  ctxc @<file>            Analyze a file
  ctxc @<directory>       Analyze all files in a directory
  ctxc "<text>"           Analyze raw text
  cat file | ctxc         Analyze piped input

Advanced mode:
  ctxc <command> [options]

Commands:
  analyze  <input>  Structural analysis: blocks, tokens, warnings
  lint     <input>  Lint rules: detect issues in prompt structure
  optimize <input>  Apply safe deterministic transforms to reduce tokens
  help              Show this help

Options:
  -h, --help     Show this help
  --json         Output as JSON
  --config       Path to config JSON file
  --text         Use raw text input instead of a file or directory path
  --stdin        Read input from stdin instead of a file or directory path
  --dry-run      Show what would change without writing (optimize only)
  --write        Write optimized content back to the file (optimize only)
  --check        Fail (exit 2) if any file would change without writing (optimize only)
  --diff         Show compact before/after snippets (optimize only)
  --only         Run only the listed optimize transform IDs (comma-separated)
  --except       Run all default optimize transforms except the listed IDs
  --fail-on      Exit 2 if any lint issue at or above the given severity exists (lint only)
                 Values: error | warning | info
                 Counts both analysis warnings and lint-rule issues.
  --max-tokens   Exit 2 if any file exceeds the token budget (analyze only, per file)
  --include      Include only files matching patterns (comma-separated, directory mode only)
  --exclude      Exclude files matching patterns (comma-separated, directory mode only)

Exit codes:
  0  Success
  1  Error (usage error, validation error, runtime failure)
  2  Check failure (--fail-on threshold exceeded, --check finds changes, --max-tokens exceeded)

Version: 0.1.0
`);
}

async function cmdAnalyze(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const jsonFlag = parsed.flags.has('json');
    const filters = parseDirectoryFilters(parsed);
    const maxTokensValue = parsed.options.get('max-tokens');
    const maxTokens = maxTokensValue !== undefined ? parseMaxTokens(maxTokensValue) : undefined;

    const input = await resolveCliInput(parsed, {
      command: 'analyze',
      usage: usageFor('analyze'),
    });

    if ((parsed.options.has('include') || parsed.options.has('exclude')) && input.kind !== 'directory') {
      throw new Error('--include and --exclude require directory input');
    }

    const config = await loadConfig({
      configPath: parsed.options.get('config'),
      knownRuleIds: KNOWN_RULE_IDS,
      knownTransformIds: KNOWN_TRANSFORM_IDS,
    });

    if (input.kind === 'directory') {
      const result = await analyzeDirectory(input.path, config, { filters });
      console.log(jsonFlag ? renderAnalyzeDirectoryJson(result) : renderAnalyzeDirectoryText(result));
      if (maxTokens !== undefined) {
        assertWithinBudget(
          result.files.map(r => ({ path: r.path, totalTokens: r.totalTokens })),
          maxTokens,
          input.path,
        );
      }
      return;
    }

    const report = analyzeInput(input, config);
    console.log(jsonFlag ? renderJson(report) : renderText(report));
    if (maxTokens !== undefined) {
      assertWithinBudget([{ path: input.path, totalTokens: report.totalTokens }], maxTokens, input.path);
    }
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(err instanceof CheckFailureError ? 2 : 1);
  }
}

async function cmdLint(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const jsonFlag = parsed.flags.has('json');
    const filters = parseDirectoryFilters(parsed);
    const failOnValue = parsed.options.get('fail-on');
    const failOn = failOnValue !== undefined ? parseFailOnSeverity(failOnValue) : undefined;

    const input = await resolveCliInput(parsed, {
      command: 'lint',
      usage: usageFor('lint'),
    });

    if ((parsed.options.has('include') || parsed.options.has('exclude')) && input.kind !== 'directory') {
      throw new Error('--include and --exclude require directory input');
    }

    const config = await loadConfig({
      configPath: parsed.options.get('config'),
      knownRuleIds: KNOWN_RULE_IDS,
      knownTransformIds: KNOWN_TRANSFORM_IDS,
    });

    if (input.kind === 'directory') {
      const result = await lintDirectory(input.path, config, { filters });
      console.log(jsonFlag ? renderLintDirectoryJson(result) : renderLintDirectoryText(result));
      if (failOn !== undefined) {
        assertLintPass(result.summary.issuesBySeverity, failOn, input.path);
      }
      return;
    }

    const report = analyzeInput(input, config);
    const lintResult = lintReport(report, config);
    console.log(jsonFlag ? renderLintJson(report, lintResult) : renderLintText(report, lintResult));
    if (failOn !== undefined) {
      const counts = countIssuesBySeverity([...report.issues, ...lintResult.issues]);
      assertLintPass(counts, failOn, input.path);
    }
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(err instanceof CheckFailureError ? 2 : 1);
  }
}

async function cmdOptimize(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const jsonFlag = parsed.flags.has('json');
    const dryRun = parsed.flags.has('dry-run');
    const diff = parsed.flags.has('diff');
    const write = parsed.flags.has('write');
    const check = parsed.flags.has('check');
    const controls = parseOptimizeControls(parsed, KNOWN_TRANSFORM_IDS);
    const filters = parseDirectoryFilters(parsed);

    if (check && write) {
      throw new Error('--check and --write cannot be used together');
    }

    const shouldWrite = write && !dryRun && !check;

    const input = await resolveCliInput(parsed, {
      command: 'optimize',
      usage: usageFor('optimize'),
    });

    if (write && !isPathInput(input)) {
      throw new Error('--write requires path input');
    }

    if ((parsed.options.has('include') || parsed.options.has('exclude')) && input.kind !== 'directory') {
      throw new Error('--include and --exclude require directory input');
    }

    const config = await loadConfig({
      configPath: parsed.options.get('config'),
      knownRuleIds: KNOWN_RULE_IDS,
      knownTransformIds: KNOWN_TRANSFORM_IDS,
    });

    if (input.kind === 'directory') {
      const result = await optimizeDirectory(input.path, config, { write: shouldWrite, controls, filters });
      console.log(
        jsonFlag
          ? renderOptimizeDirectoryJson(result)
          : renderOptimizeDirectoryText(result, { write: shouldWrite, diff }),
      );
      if (check) {
        assertOptimizeNoChanges(result.summary.filesChanged, input.path, 'file');
      }
      return;
    }

    if (!isFileLikeInput(input)) {
      throw new Error('optimize requires file, --text, or --stdin input');
    }

    const result = optimizeInput(input, config, controls);
    const wroteFile = shouldWrite && result.appliedChanges.length > 0;

    if (wroteFile) {
      await writeFile(input.path, result.optimizedContent, 'utf8');
    }

    if (jsonFlag) {
      console.log(renderOptimizeJson(result));
    } else {
      console.log(
        renderOptimizeText(result, {
          dryRun: !wroteFile,
          wroteFile,
          canWrite: isPathInput(input),
          diff,
        }),
      );
    }

    if (check) {
      const kind = input.kind === 'text' || input.kind === 'stdin' ? 'content' : 'file';
      assertOptimizeNoChanges(result.appliedChanges.length, input.path, kind);
    }
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(err instanceof CheckFailureError ? 2 : 1);
  }
}

async function cmdSimple(argv: string[]): Promise<void> {
  // Find the first positional (not a flag)
  const firstPosIdx = argv.findIndex(a => !a.startsWith('-'));
  const firstPos = firstPosIdx >= 0 ? argv[firstPosIdx] : '';
  const rest = argv.filter((_, i) => i !== firstPosIdx);

  if (firstPos.startsWith('@')) {
    // @file or @directory → strip @ and analyze as a path
    await cmdAnalyze([firstPos.slice(1), ...rest]);
  } else if (firstPos) {
    // bare positional → raw text
    await cmdAnalyze(['--text', firstPos, ...rest]);
  } else if (!process.stdin.isTTY) {
    // piped input → stdin
    await cmdAnalyze(['--stdin', ...rest]);
  } else {
    printHelp();
  }
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  // -h / --help anywhere in args → show help and exit
  if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
    printHelp();
    return;
  }

  const KNOWN_COMMANDS = new Set(['analyze', 'lint', 'optimize', 'help']);
  const [first = '', ...rest] = rawArgs;

  if (KNOWN_COMMANDS.has(first)) {
    switch (first) {
      case 'analyze':
        await cmdAnalyze(rest);
        break;
      case 'lint':
        await cmdLint(rest);
        break;
      case 'optimize':
        await cmdOptimize(rest);
        break;
      case 'help':
      default:
        printHelp();
    }
  } else {
    await cmdSimple(rawArgs);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

type ParsedArgs = {
  flags: Set<string>;
  options: Map<string, string>;
  positionals: string[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Set<string>();
  const options = new Map<string, string>();
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      // Strip optional @ prefix so @file and file both work as path inputs
      positionals.push(arg.startsWith('@') ? arg.slice(1) : arg);
      continue;
    }

    const eqIdx = arg.indexOf('=');
    if (eqIdx > 2) {
      const key = arg.slice(2, eqIdx);
      const value = arg.slice(eqIdx + 1);
      options.set(key, value);
      continue;
    }

    const key = arg.slice(2);
    if (
      key === 'config' ||
      key === 'text' ||
      key === 'only' ||
      key === 'except' ||
      key === 'include' ||
      key === 'exclude' ||
      key === 'fail-on' ||
      key === 'max-tokens'
    ) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`missing value for --${key}`);
      }
      options.set(key, value);
      i++;
      continue;
    }

    flags.add(key);
  }

  return { flags, options, positionals };
}

function usageFor(command: 'analyze' | 'lint' | 'optimize'): string {
  const base = `context-compiler ${command} <file-or-directory> [--text <text>] [--stdin] [--json] [--config <path>] [--include <patterns>] [--exclude <patterns>]`;
  if (command === 'analyze') return `${base} [--max-tokens <n>]`;
  if (command === 'lint') return `${base} [--fail-on error|warning|info]`;
  return `${base} [--dry-run] [--write] [--check] [--diff] [--only <ids>] [--except <ids>]`;
}
