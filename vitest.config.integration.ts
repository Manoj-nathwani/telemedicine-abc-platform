import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.js'],
    // Run tests sequentially to avoid database race conditions
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Global setup to clean DB once before all tests
    globalSetup: ['./tests/integration/globalSetup.ts'],
  },
});
