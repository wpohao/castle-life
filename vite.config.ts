import { defineConfig } from 'vitest/config';

export default defineConfig({
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@mlc-ai/web-llm'] },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', globals: true },
});
