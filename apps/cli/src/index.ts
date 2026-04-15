#!/usr/bin/env node

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
  lintDirectory,
  lintReport,
  optimizeDirectory,
  optimizeInput,
} from './batch.js';
import { isFileLikeInput, isPathInput, resolveCliInput } from './input.js';

const [, , command = 'help', ...args] = process.argv;

function printHelp(): void {
  console.log(`context-compiler — analyze and optimize LLM prompts

Usage:
  context-compiler <command> [options]

Commands:
  analyze  <input>  Structural analysis: blocks, tokens, warnings
  lint     <input>  Lint rules: detect issues in prompt structure
  optimize <input>  Apply safe deterministic transforms to reduce tokens
  help              Show this help

Options:
  --json       Output as JSON
  --config     Path to config JSON file
  --text       Use raw text input instead of a file or directory path
  --stdin      Read input from stdin instead of a file or directory path
  --dry-run    Show what would change without writing (optimize only)
  --write      Write optimized content back to the file (optimize only)
  --diff       Show compact before/after snippets (optimize only)

Version: 0.1.0
`);
}

async function cmdAnalyze(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const jsonFlag = parsed.flags.has('json');
    const input = await resolveCliInput(parsed, {
      command: 'analyze',
      usage: usageFor('analyze'),
    });

    const config = await loadConfig({
      configPath: parsed.options.get('config'),
      knownRuleIds: KNOWN_RULE_IDS,
      knownTransformIds: KNOWN_TRANSFORM_IDS,
    });
    if (input.kind === 'directory') {
      const result = await analyzeDirectory(input.path, config);
      console.log(jsonFlag ? renderAnalyzeDirectoryJson(result) : renderAnalyzeDirectoryText(result));
      return;
    }

    const report = analyzeInput(input, config);
    console.log(jsonFlag ? renderJson(report) : renderText(report));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function cmdLint(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const jsonFlag = parsed.flags.has('json');
    const input = await resolveCliInput(parsed, {
      command: 'lint',
      usage: usageFor('lint'),
    });

    const config = await loadConfig({
      configPath: parsed.options.get('config'),
      knownRuleIds: KNOWN_RULE_IDS,
      knownTransformIds: KNOWN_TRANSFORM_IDS,
    });
    if (input.kind === 'directory') {
      const result = await lintDirectory(input.path, config);
      console.log(jsonFlag ? renderLintDirectoryJson(result) : renderLintDirectoryText(result));
      return;
    }

    const report = analyzeInput(input, config);
    const lintResult = lintReport(report, config);
    console.log(jsonFlag ? renderLintJson(report, lintResult) : renderLintText(report, lintResult));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function cmdOptimize(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const jsonFlag = parsed.flags.has('json');
    const dryRun = parsed.flags.has('dry-run');
    const diff = parsed.flags.has('diff');
    const write = parsed.flags.has('write');
    const shouldWrite = write && !dryRun;
    const input = await resolveCliInput(parsed, {
      command: 'optimize',
      usage: usageFor('optimize'),
    });

    if (write && !isPathInput(input)) {
      throw new Error('--write requires path input');
    }

    const config = await loadConfig({
      configPath: parsed.options.get('config'),
      knownRuleIds: KNOWN_RULE_IDS,
      knownTransformIds: KNOWN_TRANSFORM_IDS,
    });
    if (input.kind === 'directory') {
      const result = await optimizeDirectory(input.path, config, { write: shouldWrite });
      console.log(
        jsonFlag
          ? renderOptimizeDirectoryJson(result)
          : renderOptimizeDirectoryText(result, { write: shouldWrite, diff }),
      );
      return;
    }

    if (!isFileLikeInput(input)) {
      throw new Error('optimize requires file, --text, or --stdin input');
    }

    const result = optimizeInput(input, config);
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
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  switch (command) {
    case 'analyze':
      await cmdAnalyze(args);
      break;
    case 'lint':
      await cmdLint(args);
      break;
    case 'optimize':
      await cmdOptimize(args);
      break;
    case 'help':
    default:
      printHelp();
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
      positionals.push(arg);
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
    if (key === 'config' || key === 'text') {
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
  const base = `context-compiler ${command} <file-or-directory> [--text <text>] [--stdin] [--json] [--config <path>]`;
  if (command !== 'optimize') return base;
  return `${base} [--dry-run] [--write] [--diff]`;
}
