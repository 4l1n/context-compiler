/**
 * Subprocess-level integration tests for the CLI entrypoint.
 *
 * These tests execute the real compiled binary at apps/cli/dist/index.js.
 * Run `pnpm build` before running these tests, or they will fail with
 * "Cannot find module" / ENOENT errors.
 *
 * Run in isolation:
 *   cd apps/cli && pnpm exec vitest run src/cli.integration.test.ts
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const CLI = resolve(REPO_ROOT, 'apps/cli/dist/index.js');

type CliResult = { exitCode: number; stdout: string; stderr: string };

function runCli(args: string[], opts: { input?: string } = {}): CliResult {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    input: opts.input,
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
    expect(stdout).toContain('Usage:');
  });

  // Compatibility expectation: current behavior falls through to help when no
  // command is provided. This is not a semantic guarantee — it is an
  // observation about the current default.
  it('exits 0 and shows usage when no args are provided', () => {
    const { exitCode, stdout } = runCli([]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Usage:');
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

