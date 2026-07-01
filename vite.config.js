import { defineConfig } from 'vite';

/** @type {import('vite').UserConfig} */
export default defineConfig({
  // GitHub Pages serves from /team-os/ subpath
  base: '/team-os/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
