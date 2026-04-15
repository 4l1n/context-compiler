/**
 * Subprocess-level integration tests for the CLI entrypoint.
 *
 * These tests execute the real compiled binary at apps/cli/dist/ctxc.js.
 * Run `pnpm build` before running these tests, or they will fail with
 * "Cannot find module" / ENOENT errors.
 *
 * Run in isolation:
 *   cd apps/cli && pnpm exec vitest run src/cli.integration.test.ts
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const CLI = resolve(REPO_ROOT, 'apps/cli/dist/ctxc.js');

type CliResult = { exitCode: number; stdout: string; stderr: string };

function runCli(args: string[], opts: { input?: string; env?: Record<string, string | undefined> } = {}): CliResult {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    input: opts.input,
    env: {
      ...process.env,
      ...opts.env,
    },
    cwd: REPO_ROOT,
    timeout: 10_000,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ─── help / usage ────────────────────────────────────────────────────────────

describe('help', () => {
  it('exits 0 and shows usage when command is "help"', () => {
    const { exitCode, stdout } = runCli(['help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Choose A Command:');
  });

  it('exits 0 and shows usage with --help flag', () => {
    const { exitCode, stdout } = runCli(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Choose A Command:');
  });

  it('exits 0 and shows usage with -h flag', () => {
    const { exitCode, stdout } = runCli(['-h']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Choose A Command:');
  });

  it('exits 0 and shows usage with --help anywhere in args', () => {
    const { exitCode, stdout } = runCli(['analyze', '--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Choose A Command:');
  });

  // In an interactive terminal (isTTY=true), no args → shows help.
  // In test context stdin is a closed pipe (isTTY=false), so simple mode
  // reads empty stdin and analyzes it. Exit 0 in both cases.
  it('exits 0 when no args are provided', () => {
    const { exitCode } = runCli([]);
    expect(exitCode).toBe(0);
  });

  it('shows compact before analyze/lint/optimize in command list', () => {
    const { stdout } = runCli(['--help']);
    const compactIdx = stdout.indexOf('compact  <input>');
    const analyzeIdx = stdout.indexOf('analyze  <input>');
    const optimizeIdx = stdout.indexOf('optimize <input>');
    expect(compactIdx).toBeGreaterThan(-1);
    expect(compactIdx).toBeLessThan(analyzeIdx);
    expect(compactIdx).toBeLessThan(optimizeIdx);
  });

  it('keeps compact and optimize roles clearly distinct', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('Front door: preview deterministic compaction');
    expect(stdout).toContain('Advanced pipeline: dry-run/write/check');
  });

  it('does not emit ANSI styling in non-TTY help output', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).not.toMatch(/\u001b\[[0-9;]*m/);
  });

  it('does not emit ANSI styling when NO_COLOR is set', () => {
    const { stdout } = runCli(['compact', '--text', 'You are helpful. You are helpful.'], {
      env: { NO_COLOR: '1' },
    });
    expect(stdout).not.toMatch(/\u001b\[[0-9;]*m/);
  });
});

// ─── version ─────────────────────────────────────────────────────────────────

describe('version', () => {
  it('exits 0 and prints bare semver with --version', () => {
    const { exitCode, stdout } = runCli(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exits 0 and prints bare semver with -v', () => {
    const { exitCode, stdout } = runCli(['-v']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('matches apps/cli/package.json version exactly', async () => {
    const pkg = JSON.parse(await readFile(resolve(REPO_ROOT, 'apps/cli/package.json'), 'utf8')) as {
      version: string;
    };
    const { stdout } = runCli(['--version']);
    expect(stdout.trim()).toBe(pkg.version);
  });

  it('help text contains the same version as package.json', async () => {
    const pkg = JSON.parse(await readFile(resolve(REPO_ROOT, 'apps/cli/package.json'), 'utf8')) as {
      version: string;
    };
    const { stdout } = runCli(['help']);
    expect(stdout).toContain(`Version: ${pkg.version}`);
  });
});

// ─── config set ──────────────────────────────────────────────────────────────

describe('config set', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ctxc-config-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function runInDir(args: string[]): { exitCode: number; stdout: string; stderr: string } {
    const result = spawnSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      env: process.env,
      cwd: tmpDir,
      timeout: 10_000,
    });
    return { exitCode: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  it('exits 0 and creates config file for valid key/value', () => {
    const { exitCode, stdout } = runInDir(['config', 'set', 'tokenizer.default', 'o200k_base']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('tokenizer.default = o200k_base');
  });

  it('config file contains correct tokenizer.default after set', async () => {
    runInDir(['config', 'set', 'tokenizer.default', 'o200k_base']);
    const raw = await readFile(join(tmpDir, 'context-compiler.config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { tokenizer: { default: string } };
    expect(parsed.tokenizer.default).toBe('o200k_base');
  });

  it('overwrites tokenizer.default without destroying other keys', async () => {
    await writeFile(
      join(tmpDir, 'context-compiler.config.json'),
      JSON.stringify({ tokenizer: { default: 'char' }, lint: { warnings: { blockTooLong: 999 } } }, null, 2),
    );
    runInDir(['config', 'set', 'tokenizer.default', 'o200k_base']);
    const raw = await readFile(join(tmpDir, 'context-compiler.config.json'), 'utf8');
    const parsed = JSON.parse(raw) as {
      tokenizer: { default: string };
      lint: { warnings: { blockTooLong: number } };
    };
    expect(parsed.tokenizer.default).toBe('o200k_base');
    expect(parsed.lint.warnings.blockTooLong).toBe(999);
  });

  it('exits 1 for unknown config key', () => {
    const { exitCode, stderr } = runInDir(['config', 'set', 'unknown.key', 'value']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('unknown config key');
  });

  it('exits 1 for invalid tokenizer.default value', () => {
    const { exitCode, stderr } = runInDir(['config', 'set', 'tokenizer.default', 'bad']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('invalid value');
  });

  it('exits 1 for unknown subcommand', () => {
    const { exitCode, stderr } = runInDir(['config', 'get', 'tokenizer.default']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('unknown config subcommand');
  });

  it('exits 1 with clear message on malformed existing JSON', async () => {
    await writeFile(join(tmpDir, 'context-compiler.config.json'), '{ not valid json }');
    const { exitCode, stderr } = runInDir(['config', 'set', 'tokenizer.default', 'char']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('malformed JSON');
  });

  it('exits 1 with clear message when --config has no following value', () => {
    const { exitCode, stderr } = runInDir(['config', 'set', 'tokenizer.default', 'char', '--config']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('missing value for --config');
  });

  it('--config <path> writes to the specified file', async () => {
    const customPath = join(tmpDir, 'custom.config.json');
    const { exitCode } = runInDir(['config', 'set', 'tokenizer.default', 'o200k_base', '--config', customPath]);
    expect(exitCode).toBe(0);
    const raw = await readFile(customPath, 'utf8');
    const parsed = JSON.parse(raw) as { tokenizer: { default: string } };
    expect(parsed.tokenizer.default).toBe('o200k_base');
  });

  it('config file tokenizer.default takes effect over built-in default', async () => {
    await writeFile(
      join(tmpDir, 'context-compiler.config.json'),
      JSON.stringify({ tokenizer: { default: 'o200k_base' } }, null, 2),
    );
    const result = spawnSync(process.execPath, [CLI, 'analyze', '--text', 'Be concise.', '--json'], {
      encoding: 'utf8',
      env: process.env,
      cwd: tmpDir,
      timeout: 10_000,
    });
    const parsed = JSON.parse(result.stdout) as { tokenizer: { id: string } };
    expect(parsed.tokenizer.id).toBe('o200k_base');
  });

  it('--tokenizer flag overrides config file tokenizer.default', async () => {
    await writeFile(
      join(tmpDir, 'context-compiler.config.json'),
      JSON.stringify({ tokenizer: { default: 'o200k_base' } }, null, 2),
    );
    const result = spawnSync(
      process.execPath,
      [CLI, 'analyze', '--text', 'Be concise.', '--json', '--tokenizer', 'char'],
      { encoding: 'utf8', env: process.env, cwd: tmpDir, timeout: 10_000 },
    );
    const parsed = JSON.parse(result.stdout) as { tokenizer: { id: string } };
    expect(parsed.tokenizer.id).toBe('char');
  });
});

// ─── analyze ─────────────────────────────────────────────────────────────────

describe('analyze', () => {
  it('exits 0 for a valid file', () => {
    const { exitCode, stdout, stderr } = runCli(['analyze', 'examples/basic-prompt.md']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('exits 1 when no input is provided', () => {
    const { exitCode, stderr } = runCli(['analyze']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('error:');
  });

  it('exits 1 for an invalid --max-tokens value', () => {
    const { exitCode, stderr } = runCli(['analyze', 'examples/basic-prompt.md', '--max-tokens', 'abc']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('error:');
  });

  it('exits 0 when file is within --max-tokens budget', () => {
    const { exitCode, stderr } = runCli(['analyze', 'examples/basic-prompt.md', '--max-tokens', '9999']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });

  it('exits 2 when file exceeds --max-tokens budget', () => {
    const { exitCode, stderr } = runCli(['analyze', 'examples/basic-prompt.md', '--max-tokens', '10']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('token budget exceeded');
  });

  it('exits 2 when any directory file exceeds --max-tokens budget', () => {
    const { exitCode, stderr } = runCli(['analyze', 'examples', '--max-tokens', '10']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('token budget exceeded');
  });

  it('exits 0 for stdin input', () => {
    const { exitCode, stdout, stderr } = runCli(['analyze', '--stdin'], { input: 'Be concise.' });
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('supports --tokenizer override', () => {
    const { exitCode, stdout, stderr } = runCli([
      'analyze',
      'examples/basic-prompt.md',
      '--tokenizer',
      'o200k_base',
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('(o200k_base)');
  });

  it('lets --tokenizer override config tokenizer selection', () => {
    const { exitCode, stdout, stderr } = runCli([
      'analyze',
      'examples/basic-prompt.md',
      '--config',
      'examples/context-compiler.config.json',
      '--tokenizer',
      'o200k_base',
      '--json',
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    const parsed = JSON.parse(stdout) as { tokenizer: { id: string } };
    expect(parsed.tokenizer.id).toBe('o200k_base');
  });

  it('exits 1 for invalid --tokenizer value', () => {
    const { exitCode, stderr } = runCli(['analyze', 'examples/basic-prompt.md', '--tokenizer', 'bad']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('--tokenizer must be');
  });

  it('does not show compact hint in non-interactive output', () => {
    const { stdout } = runCli(['analyze', '--text', 'You are helpful. You are helpful.']);
    expect(stdout).not.toContain('Next step:');
  });

  it('does not show compact hint without direct compaction signal', () => {
    const { stdout } = runCli(['analyze', '--text', 'Be concise.']);
    expect(stdout).not.toContain('Next step:');
  });

  it('does not show compact hint in --json mode', () => {
    const { stdout } = runCli(['analyze', '--text', 'You are helpful. You are helpful.', '--json']);
    expect(stdout).not.toContain('Next step:');
  });
});

// ─── lint ─────────────────────────────────────────────────────────────────────

describe('lint', () => {
  it('exits 0 for a valid file with no violations', () => {
    // basic-prompt.md has lint issues, use a clean temp file
    const { exitCode, stderr } = runCli(['lint', '--text', 'Be concise.']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });

  it('exits 0 for a file regardless of issues when --fail-on is absent', () => {
    const { exitCode, stderr } = runCli(['lint', 'examples/basic-prompt.md']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });

  it('exits 1 for an invalid --fail-on value', () => {
    const { exitCode, stderr } = runCli(['lint', 'examples/basic-prompt.md', '--fail-on', 'badvalue']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('error:');
  });

  it('exits 2 with --fail-on error when errors exist', () => {
    const { exitCode, stderr } = runCli(['lint', 'examples/basic-prompt.md', '--fail-on', 'error']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('lint check failed');
  });

  it('exits 2 with --fail-on warning when warnings exist', () => {
    const { exitCode, stderr } = runCli(['lint', 'examples/basic-prompt.md', '--fail-on', 'warning']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('lint check failed');
  });

  it('exits 2 with --fail-on error across directory', () => {
    const { exitCode, stderr } = runCli(['lint', 'examples', '--fail-on', 'error']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('lint check failed');
  });

  it('exits 2 with --fail-on error on duplicated stdin input', () => {
    const { exitCode } = runCli(
      ['lint', '--stdin', '--fail-on', 'error'],
      { input: 'You are an assistant.\n\nYou are an assistant.' },
    );
    expect(exitCode).toBe(2);
  });
});

// ─── optimize ─────────────────────────────────────────────────────────────────

describe('optimize', () => {
  it('exits 0 in dry-run mode', () => {
    const { exitCode, stdout, stderr } = runCli(['optimize', 'examples/basic-prompt.md', '--dry-run']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('exits 1 when --check and --write are combined', () => {
    const { exitCode, stderr } = runCli([
      'optimize', 'examples/basic-prompt.md', '--check', '--write',
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('--check and --write');
  });

  it('exits 2 with --check when a file has pending changes', () => {
    const { exitCode, stderr } = runCli(['optimize', 'examples/basic-prompt.md', '--check']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('optimize check failed');
  });

  it('exits 2 with --check across a directory with pending changes', () => {
    const { exitCode, stderr } = runCli(['optimize', 'examples', '--check']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('optimize check failed');
  });

  it('exits 0 with --check --stdin when content has no pending changes', () => {
    const { exitCode, stderr } = runCli(
      ['optimize', '--stdin', '--check'],
      { input: 'Be concise.' },
    );
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });

  it('exits 2 with --check --stdin when content would change', () => {
    const { exitCode, stderr } = runCli(
      ['optimize', '--stdin', '--check'],
      { input: 'You are an assistant.\n\nYou are an assistant.' },
    );
    expect(exitCode).toBe(2);
    expect(stderr).toContain('content would change');
  });

  it('exits 2 with --check --only when the selected transform finds changes', () => {
    // basic-prompt.md has duplicate Constraints sections — remove-exact-duplicates fires
    const { exitCode, stderr } = runCli([
      'optimize', 'examples/basic-prompt.md', '--check', '--only', 'remove-exact-duplicates',
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('optimize check failed');
  });

  it('shows optimized text for short non-file input', () => {
    const { exitCode, stdout, stderr } = runCli([
      'optimize',
      '--text',
      'You are helpful. You are helpful.',
      '--dry-run',
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('Result text:');
  });
});

// ─── compact ──────────────────────────────────────────────────────────────────

describe('compact', () => {
  it('exits 0 for a valid file and shows compacted text', () => {
    const { exitCode, stdout, stderr } = runCli(['compact', 'examples/basic-prompt.md']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('Compact:');
  });

  it('exits 1 when --write is provided', () => {
    const { exitCode, stderr } = runCli(['compact', 'examples/basic-prompt.md', '--write']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('preview-only');
  });

  it('exits 1 when --check is provided', () => {
    const { exitCode, stderr } = runCli(['compact', 'examples/basic-prompt.md', '--check']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('preview-only');
  });

  it('compacts short repeated sentences from --text', () => {
    const { exitCode, stdout, stderr } = runCli([
      'compact',
      '--text',
      'You are helpful. You are helpful.',
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('Result text:');
    expect(stdout).toContain('You are helpful.');
  });

  it('shows a clear no-change message', () => {
    const { exitCode, stdout, stderr } = runCli(['compact', '--text', 'Be concise.']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('Result: no deterministic compaction found.');
  });

  it('supports --tokenizer override', () => {
    const { exitCode, stdout, stderr } = runCli([
      'compact',
      '--text',
      'You are helpful. You are helpful.',
      '--tokenizer',
      'o200k_base',
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('Tokenizer: o200k_base');
  });

  it('returns optimize-shaped JSON output', () => {
    const { exitCode, stdout, stderr } = runCli([
      'compact',
      '--text',
      'You are helpful. You are helpful.',
      '--json',
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    const parsed = JSON.parse(stdout) as { optimizedContent: string; appliedChanges: unknown[] };
    expect(parsed.optimizedContent).toBe('You are helpful.');
    expect(parsed.appliedChanges.length).toBeGreaterThan(0);
  });
});

// ─── directory mode with filters ─────────────────────────────────────────────

describe('directory mode with filters', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'context-compiler-int-'));
    await writeFile(join(tmpDir, 'a.md'), 'Be concise.', 'utf8');
    await writeFile(join(tmpDir, 'b.txt'), 'Be concise.', 'utf8');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('exits 0 and processes only included files with --include', () => {
    const { exitCode, stdout, stderr } = runCli(['analyze', tmpDir, '--include', '*.md']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    // Only a.md should appear in output
    expect(stdout).toContain('a.md');
    expect(stdout).not.toContain('b.txt');
  });

  it('exits 0 and skips excluded files with --exclude', () => {
    const { exitCode, stdout, stderr } = runCli(['analyze', tmpDir, '--exclude', '*.txt']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('a.md');
    expect(stdout).not.toContain('b.txt');
  });

  it('exits 1 when --include and --exclude are used with single-file input', () => {
    const { exitCode, stderr } = runCli([
      'analyze', 'examples/basic-prompt.md', '--include', '*.md',
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('error:');
  });
});

// ─── simple mode ─────────────────────────────────────────────────────────────

describe('simple mode', () => {
  it('analyzes raw text as a positional argument', () => {
    const { exitCode, stdout, stderr } = runCli(['Be concise.']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('analyzes a file with @file prefix', () => {
    const { exitCode, stdout, stderr } = runCli(['@examples/basic-prompt.md']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('analyzes a directory with @directory prefix', () => {
    const { exitCode, stdout, stderr } = runCli(['@examples']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('analyzes piped stdin in simple mode', () => {
    const { exitCode, stdout, stderr } = runCli([], { input: 'Be concise.' });
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('keeps piped output free of ANSI styling', () => {
    const { stdout } = runCli([], { input: 'Be concise.' });
    expect(stdout).not.toMatch(/\u001b\[[0-9;]*m/);
  });

  it('passes flags through to analyze (e.g. --json)', () => {
    const { exitCode, stdout } = runCli(['Be concise.', '--json']);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('totalTokens');
  });

  it('supports @file in advanced mode too (@ prefix stripped)', () => {
    const { exitCode, stderr } = runCli(['analyze', '@examples/basic-prompt.md']);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });

  it('exits 2 with --max-tokens in simple mode', () => {
    const { exitCode, stderr } = runCli(['@examples/basic-prompt.md', '--max-tokens', '10']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('token budget exceeded');
  });
});
