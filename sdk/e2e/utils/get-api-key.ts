import { E2E_MOCK_API_KEY, setupE2eMocks } from './e2e-mocks'

const shouldRunLiveE2e = process.env.RUN_CODEBUFF_E2E === 'true'

/**
 * Utility to load SavantCode API key from environment or user credentials.
 * Defaults to a mock key for deterministic local runs.
 */
export function getApiKey(): string {
  if (shouldRunLiveE2e) {
    const apiKey = process.env.CODEBUFF_API_KEY
    if (!apiKey) {
      throw new Error(
        'CODEBUFF_API_KEY environment variable is required for live e2e tests. ' +
          'Get your API key at https://www.savant-code.com/api-keys',
      )
    }
    return apiKey
  }

  setupE2eMocks()
  process.env.CODEBUFF_API_KEY = E2E_MOCK_API_KEY
  return E2E_MOCK_API_KEY
}

/**
 * FID-016 Fix G: The placeholder skipIfNoApiKey() always returns false,
 * causing E2E tests (apply-patch, database-query, weather, etc.) to run
 * against the in-memory mock backend. The mock never executes real agent
 * tools, so file-creation/tool-execution tests fail with ENOENT. The
 * honest contract is: E2E tests that require actual tool execution should
 * only run in LIVE mode (RUN_CODEBUFF_E2E=true). Mock mode tests can verify
 * transport/auth, but not real side-effects.
 *
 * This now returns true when not in live mode, skipping E2E tests that
 * depend on real LLM tool execution.
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
 * Check if output indicates a network error (e.g., backend unreachable, timeout, rate limit).
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
