import { defineConfig } from 'vitest/config';

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  // GitHub Pages 會放在 /<repo 名稱>/ 底下；部署流程用 VITE_BASE 指定，本機開發為 /
  base: process.env.VITE_BASE ?? '/',
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@mlc-ai/web-llm'] },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', globals: true },
});
