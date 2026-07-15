import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/{parser,lint,semantic,diff,templates/render}.ts'],
      thresholds: {
        perFile: true,
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
      },
      reporter: ['text', 'json-summary'],
    },
  },
});
