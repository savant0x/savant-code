import { beforeEach } from 'bun:test'

/**
 * Global test setup for the CLI workspace.
 *
 * The repository's local dev environment often has `DIRECT_PROVIDER` and/or
 * `INFERENCE_BASE_URL` set so the app boots in direct-provider mode. Most unit
 * tests, however, exercise the SavantCode API client against a mocked backend
 * and expect backend-mode behavior. This setup clears those variables before
 * every test so that `isDirectProviderMode()` and the SDK's dev-mode bypass
 * return false by default.
 *
 * Tests that specifically want to verify direct-provider behavior can still
 * set these variables in their own `beforeEach`, which runs after this global
 * setup.
 */
beforeEach(() => {
  process.env.DIRECT_PROVIDER = ''
  process.env.INFERENCE_BASE_URL = ''
})
