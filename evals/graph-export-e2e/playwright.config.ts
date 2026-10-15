/**
 * FID-2026-0807-020 D2: Playwright config for the Code Universe `file://`
 * zero-network suite.
 *
 * Runs against the system Chrome when PLAYWRIGHT_CHANNEL is set (e.g.
 * `chrome`); otherwise uses the bundled Chromium (install once via
 * `bunx playwright install chromium`).
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
})
