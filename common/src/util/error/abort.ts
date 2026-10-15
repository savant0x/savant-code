/**
 * Standard error message for aborted requests.
 * Use this constant when throwing abort errors to ensure consistency.
 */
export const ABORT_ERROR_MESSAGE = 'Request aborted'

/**
 * Custom error class for abort errors.
 * Use this class instead of generic Error for abort errors to ensure
 * robust detection via isAbortError() (checks error.name === 'AbortError').
 */
export class AbortError extends Error {
  constructor(reason?: string) {
    super(reason ? `${ABORT_ERROR_MESSAGE}: ${reason}` : ABORT_ERROR_MESSAGE)
    this.name = 'AbortError'
  }
}

/**
 * Check if an error is an abort error.
 * Use this helper to detect abort errors in catch blocks.
 *
 * Detects both:
 * - Errors with message starting with 'Request aborted' (thrown by our code via AbortError)
 * - Native AbortError (thrown by fetch/AI SDK when AbortSignal is triggered)
 *
 * Walks the `cause` chain, matching the sibling predicates that already do so
 * (`isTransientNetworkError`, `isFetchIdleTimeoutError`): the provider
 * boundary wraps every failure — a user abort included — in a
 * `ClassifiedProviderError` whose own name is not `AbortError`, so a
 * top-level-only check turns every cancellation into an opaque provider
 * failure. Only `Error` instances are considered at each level, and a
 * caller-supplied non-Error is still never a match.
 */
export function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const seen = new Set<Error>()
  let current: Error | undefined = error
  while (current !== undefined && !seen.has(current)) {
    seen.add(current)
    // Check for our custom abort error message:
    // - Exact match: 'Request aborted'
    // - With reason: 'Request aborted: <reason>' (from AbortError class)
    if (
      current.message === ABORT_ERROR_MESSAGE ||
      current.message.startsWith(`${ABORT_ERROR_MESSAGE}: `)
    ) {
      return true
    }
    // Check for native AbortError (DOMException or Error with name 'AbortError')
    // This is thrown by fetch, AI SDK, and other web APIs when AbortSignal is triggered
    if (current.name === 'AbortError') {
      return true
    }
    const cause: unknown = (current as { cause?: unknown }).cause
    current = cause instanceof Error ? cause : undefined
  }
  return false
}
