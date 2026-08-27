import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { resolvePlatformTarget } from '../src/native/platform-targets'

/**
 * Provide sensible defaults for required client env vars during SDK tests.
 * Keeps tests from failing when a developer hasn't exported the full web env.
 */
const testDefaults: Record<string, string> = {
  NEXT_PUBLIC_CB_ENVIRONMENT: 'test',
  NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPPORT_EMAIL: 'support@savant-code.com',
  NEXT_PUBLIC_POSTHOG_API_KEY: 'test-posthog-key',
  NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://us.i.posthog.com',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder',
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL:
    'https://billing.stripe.com/p/login/test_placeholder',
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: 'test-verification',
  NEXT_PUBLIC_WEB_PORT: '3000',
}

const serverDefaults: Record<string, string> = {
  OPEN_ROUTER_API_KEY: 'test',
  OPENAI_API_KEY: 'test',
  SERPER_API_KEY: 'test',
  PORT: '4242',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  SAVANT_CODE_GITHUB_ID: 'test-id',
  SAVANT_CODE_GITHUB_SECRET: 'test-secret',
  NEXTAUTH_SECRET: 'test-secret',
  STRIPE_SECRET_KEY: 'sk_test_dummy',
  STRIPE_WEBHOOK_SECRET_KEY: 'whsec_dummy',
  STRIPE_TEAM_FEE_PRICE_ID: 'price_test',
  LOOPS_API_KEY: 'test',
  DISCORD_PUBLIC_KEY: 'test',
  DISCORD_BOT_TOKEN: 'test',
  DISCORD_APPLICATION_ID: 'test',
}

for (const [key, value] of Object.entries(testDefaults)) {
  if (!process.env[key]) {
    process.env[key] = value
  }
}

for (const [key, value] of Object.entries(serverDefaults)) {
  if (!process.env[key]) {
    process.env[key] = value
  }
}

if (process.env.CI !== 'true' && process.env.CI !== '1') {
  process.env.CI = 'true'
}

// Hint to downstream code that this is a test runtime
process.env.NODE_ENV ||= 'test'
process.env.BUN_ENV ||= 'test'

// Auto-resolve the vendored ripgrep binary for the monorepo layout, where the
// published-package node_modules path consulted by src/native/ripgrep.ts is
// absent. Platform mapping comes from the shared single-source table
// (FID-2026-0821-005 B3) — previously duplicated here. An explicit
// SAVANT_CODE_RG_PATH always wins.
if (!process.env.SAVANT_CODE_RG_PATH) {
  try {
    const target = resolvePlatformTarget()
    const localRgPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'dist',
      'vendor',
      'ripgrep',
      target.platformDir,
      target.binaryName,
    )
    if (existsSync(localRgPath)) {
      process.env.SAVANT_CODE_RG_PATH = localRgPath
    }
  } catch {
    // Unsupported test platform: leave SAVANT_CODE_RG_PATH unset, matching
    // the previous behavior for unmapped platforms.
  }
}
