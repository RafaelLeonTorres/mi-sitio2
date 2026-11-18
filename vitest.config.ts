import { defineConfig } from 'vitest/config';

// Las pruebas corren en Node. Las que necesiten DOM lo piden en su archivo con
// `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    include: ['labs/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
