import {
  FETCH_IDLE_TIMEOUT_USER_MESSAGE,
  TRANSIENT_NETWORK_ERROR_USER_MESSAGE,
  extractApiErrorDetails,
  isFetchIdleTimeoutError,
  isTransientNetworkError,
} from '@savant-code/common/util/error'

/**
 * Maps a loop failure into the error status / message / output shape used by
 * the catch block. Behavior identical to the inline block it was extracted
 * from — payment-required (402) propagation and finishAgentRun stay in the
 * caller.
 */
/**
 * The deepest Error in the `cause` chain. The provider boundary wraps every
 * failure in a `ClassifiedProviderError` whose own message is a
 * machine-readable class label (`provider call failed (…)`); the provider's
 * real message lives on the error it wrapped. The sibling extractors
 * (`extractApiErrorDetails`, `isFetchIdleTimeoutError`) already read through
 * the chain, so the user-facing fallback must too — otherwise every wrapped
 * failure is reported as the wrapper's label.
 */
function innermostError(error: Error): Error {
  const seen = new Set<Error>()
  let current: Error = error
  while (!seen.has(current)) {
    seen.add(current)
    const cause = (current as { cause?: unknown }).cause
    if (!(cause instanceof Error)) break
    current = cause
  }
  return current
}

export function buildLoopErrorOutput(params: {
  error: unknown
  signal: AbortSignal
}): {
  status: 'cancelled' | 'failed'
  errorMessage: string
  statusCode: number | undefined
  output: {
    type: 'error'
    message: string
    statusCode?: number
    error?: string
    countryCode?: string
    countryBlockReason?: string
    ipPrivacySignals?: string[]
  }
} {
  const { error, signal } = params

  const apiErrorDetails = extractApiErrorDetails(error)
  const isIdleTimeout = isFetchIdleTimeoutError(error)
  const isNetworkError = !isIdleTimeout && isTransientNetworkError(error)
  const hasServerMessage = apiErrorDetails.message !== undefined
  let fallbackMessage: string
  if (isIdleTimeout) {
    fallbackMessage = FETCH_IDLE_TIMEOUT_USER_MESSAGE
  } else if (isNetworkError) {
    fallbackMessage = TRANSIENT_NETWORK_ERROR_USER_MESSAGE
  } else if (error instanceof Error) {
    const source = innermostError(error)
    const includeStack =
      apiErrorDetails.statusCode === undefined && source.stack
    fallbackMessage =
      source.message + (includeStack ? `\n\n${source.stack}` : '')
  } else {
    fallbackMessage = String(error)
  }
  const errorMessage = apiErrorDetails.message ?? fallbackMessage
  const statusCode = apiErrorDetails.statusCode

  const status = signal.aborted ? 'cancelled' : 'failed'

  return {
    status,
    errorMessage,
    statusCode,
    output: {
      type: 'error',
      message:
        hasServerMessage || isIdleTimeout || isNetworkError
          ? errorMessage
          : 'Agent run error: ' + errorMessage,
      ...(statusCode !== undefined && { statusCode }),
      ...(apiErrorDetails.errorCode !== undefined && {
        error: apiErrorDetails.errorCode,
      }),
      ...(apiErrorDetails.countryCode !== undefined && {
        countryCode: apiErrorDetails.countryCode,
      }),
      ...(apiErrorDetails.countryBlockReason !== undefined && {
        countryBlockReason: apiErrorDetails.countryBlockReason,
      }),
      ...(apiErrorDetails.ipPrivacySignals !== undefined && {
        ipPrivacySignals: apiErrorDetails.ipPrivacySignals,
      }),
    },
  }
}
