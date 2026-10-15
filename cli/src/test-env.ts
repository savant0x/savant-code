/**
 * CLI test-environment bootstrap.
 *
 * Must evaluate before any module that imports `@savant-code/common/env`: that
 * module snapshots `NEXT_PUBLIC_CB_ENVIRONMENT` at load time, and
 * `getConfigDir()` only honors the `SAVANT_CODE_CONFIG_DIR` test override when
 * the environment is not `prod`.
 *
 * The public-release pipeline applies the canonical public profile
 * (`NEXT_PUBLIC_CB_ENVIRONMENT=prod`) to gate processes, so without this
 * pin the config-dir-dependent provider/settings tests would silently point
 * at the real `~/.savant-code/` directory instead of their isolated temp dir.
 */
process.env.NEXT_PUBLIC_CB_ENVIRONMENT = 'dev'

/**
 * Test defaults for the required client env vars. The cli `test` script runs
 * under `NODE_ENV=production` (release-gate profile), which env-boundary.ts
 * treats as a protected context, so common/env's development defaults are
 * disabled. `bun test` also only auto-loads `.env*` from the workspace cwd, so
 * the root `.env.local` is invisible here. Mirror the sdk/test/setup-env.ts
 * route: supply deterministic placeholder values for any missing required var
 * so the declared test gate passes on a fresh checkout. Real exported values
 * always win.
 */
const cliTestDefaults: Record<string, string> = {
  NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPPORT_EMAIL: 'support@savant-code.test',
  NEXT_PUBLIC_POSTHOG_API_KEY: 'test-posthog-key',
  NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://us.i.posthog.com',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder',
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL:
    'https://billing.stripe.com/p/login/test_placeholder',
  NEXT_PUBLIC_WEB_PORT: '3000',
}

for (const [key, value] of Object.entries(cliTestDefaults)) {
  if (!process.env[key]) {
    process.env[key] = value
  }
}
