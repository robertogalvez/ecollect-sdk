import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@ecollect/ui-core': resolve(__dirname, '../../packages/ui-core/src/index.ts'),
      '@ecollect/ui-react': resolve(__dirname, '../../packages/ui-react/src/index.ts'),
    },
  },
});
