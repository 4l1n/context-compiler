#!/usr/bin/env node

import { extname } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { analyze, loadFile, buildReport, runOptimize, DEFAULT_TRANSFORMS } from '@context-compiler/core';
import { runLint, DEFAULT_RULES } from '@context-compiler/rules';
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
  --dry-run    Show what would change without writing (optimize only)
  --write      Write optimized content back to the file (optimize only)

Version: 0.0.1
`);
}

async function cmdAnalyze(argv: string[]): Promise<void> {
  const file = argv.find(a => !a.startsWith('--'));
  const jsonFlag = argv.includes('--json');

  if (!file) {
    console.error('error: missing file argument\n  usage: context-compiler analyze <file> [--json]');
    process.exit(1);
  }

  try {
    const tokenizer = new CharTokenizer();
    const report = await analyze(file, tokenizer);
    console.log(jsonFlag ? renderJson(report) : renderText(report));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function cmdLint(argv: string[]): Promise<void> {
  const file = argv.find(a => !a.startsWith('--'));
  const jsonFlag = argv.includes('--json');

  if (!file) {
    console.error('error: missing file argument\n  usage: context-compiler lint <file> [--json]');
    process.exit(1);
  }

  try {
    const tokenizer = new CharTokenizer();
    const report = await analyze(file, tokenizer);
    const lintResult = runLint(DEFAULT_RULES, {
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
  const file = argv.find(a => !a.startsWith('--'));
  const jsonFlag = argv.includes('--json');
  const dryRun = argv.includes('--dry-run');
  const write = argv.includes('--write');
  const shouldWrite = write && !dryRun;

  if (!file) {
    console.error('error: missing file argument\n  usage: context-compiler optimize <file> [--dry-run] [--write] [--json]');
    process.exit(1);
  }

  try {
    const tokenizer = new CharTokenizer();
    const ext = extname(file).toLowerCase();
    const content = await loadFile(file);
    const report = buildReport(file, content, ext, tokenizer);
    const result = runOptimize(file, content, report, DEFAULT_TRANSFORMS, tokenizer);
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
