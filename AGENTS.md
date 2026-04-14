# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.
It is a contributor/agent operations guide, not end-user product documentation.

## Commands

```bash
pnpm install          # install all workspace deps
pnpm build            # compile all packages (turbo, respects dep graph)
pnpm test             # run all tests
pnpm typecheck        # type-check all packages without emitting

# single package
pnpm --filter @context-compiler/core build
pnpm --filter @context-compiler/tokenizers test

# single test file (from package dir)
cd packages/core && pnpm exec vitest run src/parser.test.ts

# run CLI after build
node apps/cli/dist/index.js help
node apps/cli/dist/index.js analyze <file>          # text output
node apps/cli/dist/index.js analyze <file> --json   # JSON output
node apps/cli/dist/index.js lint <file>
node apps/cli/dist/index.js optimize <file> --dry-run
node apps/cli/dist/index.js optimize <file> --write
node apps/cli/dist/index.js analyze <file> --config context-compiler.config.json
```

## Architecture

**Constraint**: all product logic lives in `packages/`. `apps/cli` only imports, orchestrates, and renders.

**Dep graph** (build order enforced by turbo):
```
core  ──► rules
     └──► fixtures
config
tokenizers         (no local deps)
cli ──► core, rules, tokenizers, config
```

**Analysis pipeline** (`packages/core`):
```
loadFile(path)          → string          loader.ts   (reads .txt/.md/.json)
parseBlocks(content)    → RawBlock[]      parser.ts   (code fences / headings / double-newline)
classifyBlock(content)  → BlockType       classifier.ts (heuristic, no AI)
tokenizer.count()       → number          ITokenizer  (injected by CLI)
buildReport(...)        → AnalysisReport  analyzer.ts (pure, no I/O — testable)
checkWarnings(blocks)   → AnalysisIssue[] warnings.ts (thresholds in WARN_THRESHOLDS)
```

`analyze(path, tokenizer)` in `analyzer.ts` is the I/O wrapper that calls `loadFile` then `buildReport`.

**Key types** (`packages/core/src/types.ts`):
- `AnalyzedBlock` — `{ id, content, type: BlockType, tokenCount, tokenPercent }`
- `AnalysisReport` — `{ path, blocks, issues, totalBlocks, totalTokens, createdAt }`
- `ITokenizer` — interface defined in core, implemented by `@context-compiler/tokenizers`
- `BlockType` — `instruction | constraint | example | memory | tool_output | structured_data | unknown`

**Classifier heuristics order** (first match wins, `packages/core/src/classifier.ts`):
1. `structured_data` — valid JSON, data-language code fences (json/yaml/csv/xml), markdown tables
2. `tool_output` — shell code fences, `result:`/`error:` prefixes, exception keywords
3. `memory` — temporal language, ISO dates
4. `example` — explicit "Example:" markers or `## Examples` headings
5. `constraint` — `## Constraints` headings, prohibitive first-line language
6. `instruction` — `## System/Context/Goal` headings, "You are…"/"Your task…" openers
7. `unknown` — fallback

**Adding a rule**: implement `IRule` from `@context-compiler/rules` (`check(block): AnalysisIssue[]`).

**Adding a tokenizer**: implement `ITokenizer` from `packages/core/src/types.ts`. Current `CharTokenizer` is a placeholder (4 chars/token); swap for tiktoken when accuracy matters.

## TypeScript

- ESM throughout — all packages use `"type": "module"` and `module: NodeNext`
- Imports inside `src/` **must** use `.js` extension even for `.ts` source files (NodeNext resolution)
- `tsconfig.base.json` at root, each package extends it with its own `outDir`/`rootDir`
- Test files excluded from `tsc` builds (`"exclude": ["src/**/*.test.ts"]`); vitest handles them directly
- `packages/core` requires `@types/node` (uses `node:fs/promises`, `node:path`)
