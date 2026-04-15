import esbuild from 'esbuild';
import { chmod } from 'node:fs/promises';

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
