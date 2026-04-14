#!/usr/bin/env node

import { defaultConfig } from '@context-compiler/config';

const [, , command = 'help', ...args] = process.argv;

function printHelp(): void {
  console.log(`context-compiler — analyze and optimize LLM prompts

Usage:
  context-compiler <command> [options]

Commands:
  analyze <file>   Analyze a prompt file
  help             Show this help

Version: 0.0.1
`);
}

function cmdAnalyze(file: string | undefined): void {
  if (!file) {
    console.error('error: missing file argument\n  usage: context-compiler analyze <file>');
    process.exit(1);
  }
  // TODO: wire up @context-compiler/core analysis pipeline
  console.log(`analyzing: ${file}`);
  console.log('config:', JSON.stringify(defaultConfig, null, 2));
}

function main(): void {
  switch (command) {
    case 'analyze':
      cmdAnalyze(args[0]);
      break;
    case 'help':
    default:
      printHelp();
  }
}

main();
