// Eval-suite env defaults (mirrors cli/src/test-env.ts and sdk/test/setup-env.ts).
// common/src/env-boundary.ts disables dev defaults in protected contexts, and
// bun only auto-loads .env files from the cwd — so the evals suite supplies
// test-scoped placeholders for the required NEXT_PUBLIC_* client env vars.
// Real values already present in process.env always win.
//
// FID-2026-1007-002: this file is also the evals suite's isolation preload, so
// the module-scope state the suite can inherit (the sandbox teardown mechanism
// probe) is reset before every case here rather than in a second preload entry.
import { beforeEach } from 'bun:test'

import { resetCachedMechanism } from './v2/src/sandboxes/process-tree'

process.env.NEXT_PUBLIC_CB_ENVIRONMENT = 'dev'

const evalsTestDefaults: Record<string, string> = {
  NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPPORT_EMAIL: 'support@savant-code.test',
  NEXT_PUBLIC_POSTHOG_API_KEY: 'test-posthog-key',
  NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://us.i.posthog.com',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder',
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL:
    'https://billing.stripe.com/p/login/test_placeholder',
  NEXT_PUBLIC_WEB_PORT: '3000',
}

for (const [key, value] of Object.entries(evalsTestDefaults)) {
  if (!process.env[key]) {
    process.env[key] = value
  }
}

beforeEach(() => {
  resetCachedMechanism()
})
