#!/usr/bin/env node

import { extname } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from '@context-compiler/config';
import {
  analyze,
  loadFile,
  buildReport,
  runOptimize,
  buildTransforms,
  KNOWN_TRANSFORM_IDS,
} from '@context-compiler/core';
import { runLint, buildRules, KNOWN_RULE_IDS } from '@context-compiler/rules';
import { CharTokenizer } from '@context-compiler/tokenizers';
import { renderText, renderJson } from './render.js';
import { renderLintText, renderLintJson } from './render-lint.js';
import { renderOptimizeText, renderOptimizeJson } from './render-optimize.js';

const [, , command = 'help', ...args] = process.argv;

function printHelp(): void {
  console.log(`context-compiler — analyze and optimize LLM prompts

Usage:
  context-compiler <command> [options]

Commands:
  analyze  <file>   Structural analysis: blocks, tokens, warnings
  lint     <file>   Lint rules: detect issues in prompt structure
  optimize <file>   Apply safe deterministic transforms to reduce tokens
  help              Show this help

Options:
  --json       Output as JSON
  --config     Path to config JSON file
  --dry-run    Show what would change without writing (optimize only)
  --write      Write optimized content back to the file (optimize only)

Version: 0.1.0
`);
}

async function cmdAnalyze(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const file = parsed.positionals[0];
    const jsonFlag = parsed.flags.has('json');

    if (!file) {
      console.error('error: missing file argument\n  usage: context-compiler analyze <file> [--json] [--config <path>]');
      process.exit(1);
    }

    const config = await loadConfig({
      configPath: parsed.options.get('config'),
      knownRuleIds: KNOWN_RULE_IDS,
      knownTransformIds: KNOWN_TRANSFORM_IDS,
    });
    const tokenizer = createTokenizer(config.tokenizer.char.charsPerToken);
    const report = await analyze(file, tokenizer, {
      warningThresholds: config.lint.warnings,
    });
    console.log(jsonFlag ? renderJson(report) : renderText(report));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function cmdLint(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const file = parsed.positionals[0];
    const jsonFlag = parsed.flags.has('json');

    if (!file) {
      console.error('error: missing file argument\n  usage: context-compiler lint <file> [--json] [--config <path>]');
      process.exit(1);
    }

    const config = await loadConfig({
      configPath: parsed.options.get('config'),
      knownRuleIds: KNOWN_RULE_IDS,
      knownTransformIds: KNOWN_TRANSFORM_IDS,
    });
    const tokenizer = createTokenizer(config.tokenizer.char.charsPerToken);
    const report = await analyze(file, tokenizer, {
      warningThresholds: config.lint.warnings,
    });
    const rules = buildRules({
      enabledRuleIds: config.lint.rules.enabled,
      disabledRuleIds: config.lint.rules.disabled,
      thresholds: {
        noisyToolOutputTokens: config.lint.thresholds.noisyToolOutputTokens,
        oversizedExampleRatio: config.lint.thresholds.oversizedExampleRatio,
      },
    });
    const lintResult = runLint(rules, {
      path: report.path,
      blocks: report.blocks,
      totalTokens: report.totalTokens,
    });
    console.log(jsonFlag ? renderLintJson(report, lintResult) : renderLintText(report, lintResult));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function cmdOptimize(argv: string[]): Promise<void> {
  try {
    const parsed = parseArgs(argv);
    const file = parsed.positionals[0];
    const jsonFlag = parsed.flags.has('json');
    const dryRun = parsed.flags.has('dry-run');
    const write = parsed.flags.has('write');
    const shouldWrite = write && !dryRun;

    if (!file) {
      console.error(
        'error: missing file argument\n  usage: context-compiler optimize <file> [--dry-run] [--write] [--json] [--config <path>]',
      );
      process.exit(1);
    }

    const config = await loadConfig({
      configPath: parsed.options.get('config'),
      knownRuleIds: KNOWN_RULE_IDS,
      knownTransformIds: KNOWN_TRANSFORM_IDS,
    });
    const tokenizer = createTokenizer(config.tokenizer.char.charsPerToken);
    const ext = extname(file).toLowerCase();
    const content = await loadFile(file);
    const report = buildReport(file, content, ext, tokenizer, {
      warningThresholds: config.lint.warnings,
    });
    const transforms = buildTransforms({
      enabledTransformIds: config.optimize.transforms.enabled,
      disabledTransformIds: config.optimize.transforms.disabled,
      thresholds: {
        truncateToolOutputTokens: config.optimize.thresholds.truncateToolOutputTokens,
        trimOversizedExamplesPercent: config.optimize.thresholds.trimOversizedExamplesPercent,
      },
    });
    const result = runOptimize(file, content, report, transforms, tokenizer);
    const wroteFile = shouldWrite && result.appliedChanges.length > 0;

    if (wroteFile) {
      await writeFile(file, result.optimizedContent, 'utf8');
    }

    if (jsonFlag) {
      console.log(renderOptimizeJson(result));
    } else {
      console.log(renderOptimizeText(result, { dryRun: !wroteFile, wroteFile }));
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

function createTokenizer(charsPerToken: number): CharTokenizer {
  return new CharTokenizer(charsPerToken);
}

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
    if (key === 'config') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('missing value for --config');
      }
      options.set(key, value);
      i++;
      continue;
    }

    flags.add(key);
  }

  return { flags, options, positionals };
}
