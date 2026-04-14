# Examples

Run these from the repository root.

```bash
pnpm install
pnpm build
pnpm cc analyze examples/basic-prompt.md
pnpm cc lint examples/basic-prompt.md
pnpm cc optimize examples/basic-prompt.md --dry-run
```

Use the example config explicitly:

```bash
pnpm cc analyze examples/basic-prompt.md --config examples/context-compiler.config.json
pnpm cc lint examples/basic-prompt.md --config examples/context-compiler.config.json
pnpm cc optimize examples/basic-prompt.md --dry-run --config examples/context-compiler.config.json
```

Use explicit non-file input:

```bash
pnpm cc analyze --text "Be concise. Be concise."
pnpm cc lint --text "Be concise. Be concise."
pnpm cc optimize --text "Be concise. Be concise." --dry-run

echo "Be concise. Be concise." | pnpm cc analyze --stdin
echo "Be concise. Be concise." | pnpm cc lint --stdin
echo "Be concise. Be concise." | pnpm cc optimize --stdin --dry-run
```

`optimize` does not write by default. Use `--write` only when you want to replace the input file with the optimized content.
