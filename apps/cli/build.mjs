import esbuild from 'esbuild';
import { chmod, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/ctxc.js',
  // js-tiktoken is kept as a real npm runtime dependency rather than bundled.
  // It ships its own pre-built data files that must be resolved at runtime;
  // inlining it into the bundle would break those resolution paths.
  external: ['js-tiktoken'],
  banner: { js: '#!/usr/bin/env node' },
});

await chmod('dist/ctxc.js', 0o755);

// Copy metadata files to the package root so they are included in the published artifact
await cp(join(rootDir, 'README.md'), join(__dirname, 'README.md'));
await cp(join(rootDir, 'LICENSE'), join(__dirname, 'LICENSE'));
