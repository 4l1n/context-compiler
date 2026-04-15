# AGENTS.md

Canonical contributor/agent workflow guide for this repository.
End-user usage belongs in `README.md`.

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm benchmark
pnpm verify

# CLI after build
pnpm cc help
pnpm cc analyze examples/basic-prompt.md
pnpm cc analyze examples
pnpm cc analyze --text "Be concise. Be concise."
echo "Be concise. Be concise." | pnpm cc analyze --stdin
pnpm cc lint examples/basic-prompt.md
pnpm cc lint examples
pnpm cc optimize examples/basic-prompt.md --dry-run
pnpm cc optimize examples --dry-run
pnpm cc optimize examples/basic-prompt.md --dry-run --diff
pnpm cc analyze examples/protected-prompt.md

# Single package
pnpm --filter @context-compiler/core build
pnpm --filter @context-compiler/rules test

# Single test file
cd packages/core && pnpm exec vitest run src/parser.test.ts
```

## Architecture Rules

- Product logic lives in `packages/`.
- `apps/cli` imports packages, orchestrates commands, and renders output.
- Directory discovery and batch orchestration are CLI-layer behavior.
- Tokenizer default stays `char`; `o200k_base` is config-selected.
- No AI calls, plugins, integrations, frontend, or remote services in the current release scope.
- Repo-facing text should stay in English.

## Workspace Graph

```text
core  ──► rules
     └──► fixtures
config
tokenizers
cli ──► core, rules, tokenizers, config
```

## Core Pipeline

```text
loadFile(path)       -> string
parseBlocks(content) -> RawBlock[]
classifyBlock(text)  -> BlockType
tokenizer.count()    -> number
buildReport(...)     -> AnalysisReport
checkWarnings(...)   -> AnalysisIssue[]
runOptimize(...)     -> OptimizationResult
```

## TypeScript Notes

- ESM throughout.
- Package `src/` imports must use `.js` extensions under NodeNext.
- Tests are excluded from `tsc` builds and run through Vitest.
- Keep changes scoped; avoid broad refactors unless explicitly requested.
