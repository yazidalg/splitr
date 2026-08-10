import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // The config lives in web/, but Vite's root defaults to process.cwd() (the repo
  // root, where npm scripts run). Pin it explicitly.
  root: here,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The hero demo imports ../src/money.ts — the CLI's splitting engine — which
    // lives outside the Vite root.
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
