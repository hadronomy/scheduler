import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  platform: 'node',
  format: ['esm'],
  dts: false,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env bun run',
  },
  exports: {
    devExports: true,
  },
});
