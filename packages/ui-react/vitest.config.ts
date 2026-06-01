import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/__tests__/setup.ts'], globals: true },
  resolve: {
    alias: {
      '@ecollect/ui-core': fileURLToPath(new URL('../ui-core/src/index.ts', import.meta.url)),
    },
  },
});
