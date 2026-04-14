# context-compiler

Local-first tool to analyze, lint, and optimize prompts/context for LLM agents.
Reduces noise and token count. No external API calls.

## Packages

| Package | Description |
|---|---|
| `@context-compiler/core` | Domain types (PromptBlock, AnalysisReport, …) |
| `@context-compiler/tokenizers` | Token counting interface + char-based impl |
| `@context-compiler/rules` | Lint rule interface |
| `@context-compiler/fixtures` | Test fixtures |
| `@context-compiler/config` | Config types and defaults |
| `apps/cli` | CLI entry point |

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

## CLI

```bash
node apps/cli/dist/index.js help
node apps/cli/dist/index.js analyze <file>
```
