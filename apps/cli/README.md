# context-compiler-cli

CLI package for [context-compiler](https://github.com/4l1n/context-compiler).

Install:

```bash
npm install -g context-compiler-cli
```

Primary command:

```bash
ctxc --help
```

Compatibility alias:

```bash
context-compiler --help
```

Start with deterministic compaction preview:

```bash
ctxc compact --text "You are helpful. You are helpful."
```

Command roles:
- `compact`: front door preview of deterministic compaction and resulting text
- `analyze`: inspect structure, token counts, warnings
- `lint`: detect prompt/context debt
- `optimize`: advanced pipeline controls (`--write`, `--check`, transform filtering)

Tokenizer options:
- `char` (default, fast/simple)
- `o200k_base` (more realistic for its model family)

For full usage and examples, see the repository README.
