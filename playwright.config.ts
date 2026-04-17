import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for API-level and DB-level E2E tests.
 *
 * No browser is required — all tests use the `request` fixture or raw `fetch` for HTTP calls
 * and the @neondatabase/serverless client for DB assertions.
 *
 * Required env vars:
 *   DATABASE_URL  — points to the development database
 *   TEST_BASE_URL — base URL for the running app (default: http://localhost:5000)
 *
 * Run:
 *   npx playwright test tests/e2e/split-listing-booking.spec.ts
 *   # or add a script to package.json:
 *   #   "test:e2e:split": "playwright test tests/e2e/split-listing-booking.spec.ts"
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api',
    },
  ],
});
