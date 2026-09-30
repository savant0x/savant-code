import { setupE2eMocks } from './e2e-mocks'
import { SavantCodeClient } from '../../src/client'

const shouldRunLiveE2e = process.env.RUN_SAVANT_CODE_E2E === 'true'

/**
 * Build the SavantCodeClient the e2e suites run against.
 *
 * FID-2026-0929-005 (gut the backend): the client takes no credential —
 * there is no backend to authenticate against. Mock mode installs the LLM
 * spies and returns a keyless client; live mode returns the same keyless
 * client and the caller's own provider env (DIRECT_PROVIDER /
 * INFERENCE_BASE_URL / provider keys) supplies the inference lane.
 */
export function setupMockClient(options?: {
  cwd?: string
}): SavantCodeClient {
  if (!shouldRunLiveE2e) {
    setupE2eMocks()
  }
  return new SavantCodeClient({ cwd: options?.cwd })
}

/**
 * Legacy alias kept for the suites that only consult the skip gate.
 *
 * FID-016 Fix G: E2E tests that require actual tool execution should only
 * run in LIVE mode (RUN_SAVANT_CODE_E2E=true). Mock mode tests can verify
 * transport behavior, but not real side-effects.
 */
export function skipIfNoApiKey(): boolean {
  return !shouldRunLiveE2e
}

/**
 * Check if output indicates an authentication error.
 */
export function isAuthError(output: {
  type: string
  message?: string
}): boolean {
  if (output.type !== 'error') return false
  const msg = output.message?.toLowerCase() ?? ''
  return (
    msg.includes('authentication') ||
    msg.includes('api key') ||
    msg.includes('unauthorized')
  )
}

/**
 * Check if output indicates a network error (e.g., endpoint unreachable, timeout, rate limit).
 */
export function isNetworkError(output: {
  type: string
  message?: string
  statusCode?: number
}): boolean {
  if (output.type !== 'error') return false
  const msg = output.message?.toLowerCase() ?? ''
  // Check for retryable status codes (408 timeout, 429 rate limit, 5xx server errors)
  // or network-related messages
  const isRetryableStatusCode =
    output.statusCode !== undefined &&
    (output.statusCode === 408 ||
      output.statusCode === 429 ||
      output.statusCode >= 500)
  return isRetryableStatusCode || msg.includes('network error')
}
