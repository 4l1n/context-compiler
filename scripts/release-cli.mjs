#!/usr/bin/env node
/**
 * Release helper for the context-compiler-cli package.
 *
 * Usage:
 *   node scripts/release-cli.mjs [patch|minor|major]
 *   node scripts/release-cli.mjs --help
 *
 * The script:
 *   1. Bumps the version in apps/cli/package.json (and mirrors it to root package.json)
 *   2. Runs pnpm build
 *   3. Verifies the compiled binary reports the new version via --version
 *   4. Scans the bundle for the stale old version string (Version: <prev>) to catch regressions
 *   5. Prints the exact next steps — does NOT publish automatically
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const cliPkgPath = join(repoRoot, 'apps/cli/package.json');
const rootPkgPath = join(repoRoot, 'package.json');
const cliBinPath = join(repoRoot, 'apps/cli/dist/ctxc.js');

const USAGE = `Usage: node scripts/release-cli.mjs [patch|minor|major]

  patch  (default)  0.2.1 → 0.2.2
  minor             0.2.1 → 0.3.0
  major             0.2.1 → 1.0.0
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const bump = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(bump)) {
  process.stderr.write(`error: invalid bump type "${bump}". Must be patch, minor, or major.\n\n${USAGE}`);
  process.exit(1);
}

// Read current version
const cliPkg = JSON.parse(readFileSync(cliPkgPath, 'utf8'));
const prev = cliPkg.version;
const [major, minor, patch] = prev.split('.').map(Number);

const next =
  bump === 'major' ? `${major + 1}.0.0`
  : bump === 'minor' ? `${major}.${minor + 1}.0`
  : `${major}.${minor}.${patch + 1}`;

console.log(`Bumping version: ${prev} → ${next}`);

// Write bumped version to apps/cli/package.json
cliPkg.version = next;
writeFileSync(cliPkgPath, JSON.stringify(cliPkg, null, 2) + '\n');

// Mirror to root package.json
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
rootPkg.version = next;
writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');

console.log('Building…');
execSync('pnpm build', { stdio: 'inherit', cwd: repoRoot });

// Verify --version output
const versionResult = spawnSync(process.execPath, [cliBinPath, '--version'], { encoding: 'utf8' });
const emitted = versionResult.stdout.trim();
if (emitted !== next) {
  process.stderr.write(`error: version mismatch — binary emits "${emitted}", expected "${next}"\n`);
  process.exit(1);
}
console.log(`Verified: ctxc --version = ${emitted}`);

// Scan bundle for stale "Version: <prev>" literal (narrow check, avoids false positives)
const bundle = readFileSync(cliBinPath, 'utf8');
const stalePattern = `Version: ${prev}`;
if (bundle.includes(stalePattern)) {
  process.stderr.write(
    `error: built bundle still contains stale version string "${stalePattern}"\n` +
    `       Check that esbuild define injection is working correctly.\n`,
  );
  process.exit(1);
}
console.log('Bundle stale-version check passed.');

console.log(`
Done. Next steps:

  git add apps/cli/package.json package.json
  git commit -m "chore: release cli v${next}"
  git tag v${next}
  git push && git push --tags
  cd apps/cli && npm publish --access public
`);
