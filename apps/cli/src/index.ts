import { writeFile } from 'node:fs/promises';
import { loadConfig } from '@context-compiler/config';
import type { ContextCompilerConfig } from '@context-compiler/config';
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
import { hasDirectCompactionSignal } from './compaction-signals.js';
import { shouldUseColor } from './style.js';
import {
  CheckFailureError,
  assertLintPass,
  assertOptimizeNoChanges,
  assertWithinBudget,
  parseFailOnSeverity,
  parseMaxTokens,
} from './check.js';

function printHelp(): void {
  console.log(`context-compiler — deterministic prompt/context compaction and inspection

Start Here:
  ctxc compact --text "You are helpful. You are helpful."
  ctxc compact @prompt.md
  cat prompt.md | ctxc compact --stdin

Choose A Command:
  compact  <input>  Front door: preview deterministic compaction and resulting text
  analyze  <input>  Inspect structure, token counts, and warnings
  lint     <input>  Detect prompt/context debt with deterministic rules
  optimize <input>  Advanced pipeline: dry-run/write/check and transform controls
  help              Show this help

Common Inputs And Output:
  ctxc @<file>            Simple mode analyze for a file
  ctxc @<directory>       Simple mode analyze for a directory
  ctxc "<text>"           Simple mode analyze for raw text
  cat file | ctxc         Simple mode analyze for piped input
  --text <raw>            Explicit raw content input
  --stdin                 Explicit stdin input
  --json                  Machine-readable output
  --config <path>         Explicit config file path

Compaction Controls (compact/optimize):
  --diff                  Show compact before/after snippets
  --only <id,id>          Run only selected transform IDs
  --except <id,id>        Exclude selected transform IDs

Optimize-Only Pipeline Controls:
  --dry-run               Preview without writing
  --write                 Apply changes to file/directory input
  --check                 Exit 2 when changes would be applied

Quality Gates:
  --fail-on error|warning|info    Lint exit threshold (lint only)
  --max-tokens <n>                Per-file token budget gate (analyze only)

Directory Targeting:
  --include <patterns>    Include only matching files
  --exclude <patterns>    Exclude matching files

Tokenizer:
  --tokenizer char|o200k_base
  char is fast/simple. o200k_base is more realistic for its model family.

Exit Codes:
  0  Success
  1  Error (usage, validation, runtime)
  2  Check failure (--fail-on, --check, --max-tokens)

Version: 0.2.0
`);
}

async function cmdAnalyze(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const jsonFlag = parsed.flags.has('json');
    const useColor = shouldUseColor();
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

    const config = await loadRuntimeConfig(parsed);

    if (input.kind === 'directory') {
      const result = await analyzeDirectory(input.path, config, { filters });
      console.log(
        jsonFlag ? renderAnalyzeDirectoryJson(result) : renderAnalyzeDirectoryText(result, { useColor }),
      );
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
    const showCompactHint =
      !jsonFlag &&
      process.stdout.isTTY === true &&
      hasDirectCompactionSignal(report);
    const hintCommand =
      input.kind === 'file'
        ? `run \`ctxc compact ${input.path}\``
        : input.kind === 'text'
          ? 'run `ctxc compact --text "<your text>"`'
          : 'run `cat ... | ctxc compact --stdin`';
    console.log(
      jsonFlag
        ? renderJson(report)
        : renderText(report, {
            useColor,
            compactHint: showCompactHint ? hintCommand : undefined,
          }),
    );
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
    const useColor = shouldUseColor();
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

    const config = await loadRuntimeConfig(parsed);

    if (input.kind === 'directory') {
      const result = await lintDirectory(input.path, config, { filters });
      console.log(jsonFlag ? renderLintDirectoryJson(result) : renderLintDirectoryText(result, { useColor }));
      if (failOn !== undefined) {
        assertLintPass(result.summary.issuesBySeverity, failOn, input.path);
      }
      return;
    }

    const report = analyzeInput(input, config);
    const lintResult = lintReport(report, config);
    console.log(jsonFlag ? renderLintJson(report, lintResult) : renderLintText(report, lintResult, { useColor }));
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
    const useColor = shouldUseColor();
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

    const config = await loadRuntimeConfig(parsed);

    if (input.kind === 'directory') {
      const result = await optimizeDirectory(input.path, config, { write: shouldWrite, controls, filters });
      console.log(
        jsonFlag
          ? renderOptimizeDirectoryJson(result)
          : renderOptimizeDirectoryText(result, { write: shouldWrite, diff, useColor }),
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
          showOptimizedContent: input.kind === 'text' || input.kind === 'stdin',
          command: 'optimize',
          useColor,
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

async function cmdCompact(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const jsonFlag = parsed.flags.has('json');
    const useColor = shouldUseColor();
    const diff = parsed.flags.has('diff');
    const controls = parseOptimizeControls(parsed, KNOWN_TRANSFORM_IDS);
    const filters = parseDirectoryFilters(parsed);

    if (parsed.flags.has('write')) {
      throw new Error('--write is not supported for compact (preview-only)');
    }
    if (parsed.flags.has('check')) {
      throw new Error('--check is not supported for compact (preview-only)');
    }

    const input = await resolveCliInput(parsed, {
      command: 'compact',
      usage: usageFor('compact'),
    });

    if ((parsed.options.has('include') || parsed.options.has('exclude')) && input.kind !== 'directory') {
      throw new Error('--include and --exclude require directory input');
    }

    const config = await loadRuntimeConfig(parsed);

    if (input.kind === 'directory') {
      const result = await optimizeDirectory(input.path, config, { controls, filters, write: false });
      console.log(
        jsonFlag
          ? renderOptimizeDirectoryJson(result)
          : renderOptimizeDirectoryText(result, { write: false, diff, command: 'compact', useColor }),
      );
      return;
    }

    if (!isFileLikeInput(input)) {
      throw new Error('compact requires file, --text, or --stdin input');
    }

    const result = optimizeInput(input, config, controls);
    if (jsonFlag) {
      console.log(renderOptimizeJson(result));
    } else {
      console.log(
        renderOptimizeText(result, {
          dryRun: true,
          wroteFile: false,
          canWrite: false,
          diff,
          showOptimizedContent: true,
          command: 'compact',
          useColor,
        }),
      );
    }
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
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

  const KNOWN_COMMANDS = new Set(['analyze', 'lint', 'optimize', 'compact', 'help']);
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
      case 'compact':
        await cmdCompact(rest);
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
      key === 'tokenizer' ||
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

function usageFor(command: 'analyze' | 'lint' | 'optimize' | 'compact'): string {
  const base = `context-compiler ${command} <file-or-directory> [--text <text>] [--stdin] [--json] [--config <path>] [--tokenizer <char|o200k_base>] [--include <patterns>] [--exclude <patterns>]`;
  if (command === 'analyze') return `${base} [--max-tokens <n>]`;
  if (command === 'lint') return `${base} [--fail-on error|warning|info]`;
  if (command === 'compact') return `${base} [--diff] [--only <ids>] [--except <ids>]`;
  return `${base} [--dry-run] [--write] [--check] [--diff] [--only <ids>] [--except <ids>]`;
}

async function loadRuntimeConfig(parsed: ParsedArgs): Promise<ContextCompilerConfig> {
  const config = await loadConfig({
    configPath: parsed.options.get('config'),
    knownRuleIds: KNOWN_RULE_IDS,
    knownTransformIds: KNOWN_TRANSFORM_IDS,
  });

  const tokenizerId = parsed.options.get('tokenizer');
  if (!tokenizerId) return config;
  if (tokenizerId !== 'char' && tokenizerId !== 'o200k_base') {
    throw new Error(`--tokenizer must be "char" or "o200k_base", got "${tokenizerId}"`);
  }

  return {
    ...config,
    tokenizer: {
      ...config.tokenizer,
      default: tokenizerId,
    },
  };
}
