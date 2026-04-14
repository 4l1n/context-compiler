# Examples

Run these from the repository root.

```bash
pnpm install
pnpm build
pnpm cli analyze examples/basic-prompt.md
pnpm cli lint examples/basic-prompt.md
pnpm cli optimize examples/basic-prompt.md --dry-run
```

Use the example config explicitly:

```bash
pnpm cli analyze examples/basic-prompt.md --config examples/context-compiler.config.json
pnpm cli lint examples/basic-prompt.md --config examples/context-compiler.config.json
pnpm cli optimize examples/basic-prompt.md --dry-run --config examples/context-compiler.config.json
```

`optimize` does not write by default. Use `--write` only when you want to replace the input file with the optimized content.
