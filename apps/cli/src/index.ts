#!/usr/bin/env node

import { analyze } from '@context-compiler/core';
import { runLint, DEFAULT_RULES } from '@context-compiler/rules';
import { CharTokenizer } from '@context-compiler/tokenizers';
import { renderText, renderJson } from './render.js';
import { renderLintText, renderLintJson } from './render-lint.js';

const [, , command = 'help', ...args] = process.argv;

function printHelp(): void {
  console.log(`context-compiler — analyze and optimize LLM prompts

Usage:
  context-compiler <command> [options]

Commands:
  analyze <file>   Structural analysis: blocks, tokens, warnings
  lint    <file>   Lint rules: detect issues in prompt structure
  help             Show this help

Options:
  --json           Output as JSON

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

async function main(): Promise<void> {
  switch (command) {
    case 'analyze':
      await cmdAnalyze(args);
      break;
    case 'lint':
      await cmdLint(args);
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
