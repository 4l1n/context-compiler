# context-compiler

## Project Overview

`context-compiler` is a local-first CLI tool designed to inspect, lint, and deterministically compact prompt contexts (such as `.md`, `.txt`, and `.json` files). It helps users understand what is inside a prompt/context file before sending it to an LLM.

**Key Features:**
- Analyzes files by splitting them into blocks and classifying them heuristically.
- Counts tokens using configurable tokenizers (e.g., `char`, `o200k_base`).
- Lints contexts for issues like duplicated instructions, oversized example sections, and noisy tool outputs.
- Optimizes contexts through safe, deterministic transforms.
- Runs entirely locally without remote API calls.

**Architecture:**
The project is a monorepo managed with `pnpm` and `turbo`. The workspace is divided into several packages:
- `apps/cli`: Command orchestration and terminal rendering.
- `packages/core`: Parsing, classification, analysis, and optimization pipeline.
- `packages/rules`: Lint rules and lint runner.
- `packages/tokenizers`: Tokenizer interface and implementations.
- `packages/config`: Configuration schema, defaults, and loader.
- `packages/fixtures`: Prompt/context fixtures used for testing.

**Key Technologies:**
- TypeScript
- Node.js
- pnpm (Package Manager)
- Turborepo (Monorepo Build System)
- Vitest (Testing Framework)

## Building and Running

The project relies on `pnpm` for package management and script execution.

**Setup & Build:**
```bash
pnpm install
pnpm build
```

**Running the CLI locally (in-repo):**
The `pnpm cc` script runs the built CLI from `apps/cli/dist/ctxc.js`.
```bash
pnpm cc <command> [options]

# Examples
pnpm cc analyze examples/basic-prompt.md
pnpm cc lint examples/basic-prompt.md
pnpm cc optimize examples/basic-prompt.md --dry-run
```

**Testing & Verification:**
```bash
pnpm test          # Run Vitest test suite
pnpm typecheck     # Run TypeScript type checking
pnpm benchmark     # Run local performance benchmarks
pnpm verify        # Runs test, typecheck, build, and benchmark sequentially
```

## Development Conventions

- **Testing:** The project uses `vitest`. Tests are located alongside source files (e.g., `index.test.ts`). There are also golden fixture summaries used to ensure analysis and optimization behavior remain deterministic.
- **Determinism:** The core goal of the project is determinism. Optimizations and classifications must be consistent and reach a fixed point.
- **Local-first:** The project must not rely on remote API calls (e.g., no external models are called during CLI execution).
- **Tooling:** Development relies on Turborepo for caching and task orchestration (`pnpm build`, `pnpm test`, etc. run via `turbo`).
