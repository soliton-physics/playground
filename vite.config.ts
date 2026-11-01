import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'esnext' },
  optimizeDeps: { exclude: ['@soliton-physics/soliton-wasm'] },
  server: { fs: { allow: ['..'] } },
});
