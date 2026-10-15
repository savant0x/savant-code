import type { JSONValue } from '../../types/json'

/**
 * Parses a JSON response body string from an API error to extract structured error details.
 * Used to extract machine-readable error codes and human-readable messages from API responses
 * (e.g., AI SDK's APICallError includes a responseBody with the server's JSON response).
 *
 * Returns extracted fields, or an empty object if the responseBody is not a valid JSON string
 * with the expected shape.
 */
export function parseApiErrorResponseBody(responseBody: unknown): {
  errorCode?: string
  message?: string
  countryCode?: string
  countryBlockReason?: string
  ipPrivacySignals?: string[]
} {
  if (typeof responseBody !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(responseBody)
    if (!parsed || typeof parsed !== 'object') return {}
    const result: {
      errorCode?: string
      message?: string
      countryCode?: string
      countryBlockReason?: string
      ipPrivacySignals?: string[]
    } = {}
    if (
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
    ) {
      result.errorCode = (parsed as { error: string }).error
    }
    if (
      'message' in parsed &&
      typeof (parsed as { message: unknown }).message === 'string'
    ) {
      result.message = (parsed as { message: string }).message
    }
    // OpenAI-style nested error object: { error: { message, code, type } }.
    // Upstream provider errors (Fireworks, OpenRouter, etc.) are relayed to
    // the client in this shape.
    if (
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'object' &&
      (parsed as { error: unknown }).error !== null
    ) {
      const nested = (parsed as { error: Record<string, JSONValue> }).error
      if (result.errorCode === undefined) {
        if (typeof nested.code === 'string') {
          result.errorCode = nested.code
        } else if (typeof nested.type === 'string') {
          result.errorCode = nested.type
        }
      }
      if (result.message === undefined && typeof nested.message === 'string') {
        result.message = nested.message
      }
    }
    if (
      'countryCode' in parsed &&
      typeof (parsed as { countryCode: unknown }).countryCode === 'string'
    ) {
      result.countryCode = (parsed as { countryCode: string }).countryCode
    }
    if (
      'countryBlockReason' in parsed &&
      typeof (parsed as { countryBlockReason: unknown }).countryBlockReason ===
        'string'
    ) {
      result.countryBlockReason = (
        parsed as { countryBlockReason: string }
      ).countryBlockReason
    }
    if ('ipPrivacySignals' in parsed) {
      const signals = (parsed as { ipPrivacySignals: unknown }).ipPrivacySignals
      if (Array.isArray(signals)) {
        result.ipPrivacySignals = signals.filter(
          (signal): signal is string => typeof signal === 'string',
        )
      }
    }
    return result
  } catch {
    return {}
  }
}

export type ApiErrorDetails = ReturnType<typeof parseApiErrorResponseBody> & {
  statusCode?: number
}

export function getApiErrorCandidates(
  error: unknown,
  seen = new Set<object>(),
): object[] {
  // ECHO Law 6 trust-boundary: validate object shape at every recursion level.
  if (!error || typeof error !== 'object') return []
  const errObj = error as object
  if (seen.has(errObj)) return []
  seen.add(errObj)

  const candidates: object[] = [errObj]
  const errorWithNested = errObj as {
    lastError?: unknown
    errors?: unknown[]
    cause?: unknown
  }

  if (
    errorWithNested.lastError &&
    typeof errorWithNested.lastError === 'object' &&
    !seen.has(errorWithNested.lastError)
  ) {
    candidates.push(...getApiErrorCandidates(errorWithNested.lastError, seen))
  }

  if (Array.isArray(errorWithNested.errors)) {
    for (const nestedError of [...errorWithNested.errors].reverse()) {
      if (
        nestedError &&
        typeof nestedError === 'object' &&
        !seen.has(nestedError)
      ) {
        candidates.push(...getApiErrorCandidates(nestedError, seen))
      }
    }
  }

  if (
    errorWithNested.cause &&
    typeof errorWithNested.cause === 'object' &&
    !seen.has(errorWithNested.cause)
  ) {
    candidates.push(...getApiErrorCandidates(errorWithNested.cause, seen))
  }

  return candidates
}

export function getApiErrorStatusCode(error: unknown): number | undefined {
  // ECHO Law 6 trust-boundary: validate object shape before field access.
  if (!error || typeof error !== 'object') return undefined

  if ('statusCode' in error) {
    const statusCode = (error as { statusCode: unknown }).statusCode
    if (typeof statusCode === 'number') return statusCode
  }

  if ('status' in error) {
    const status = (error as { status: unknown }).status
    if (typeof status === 'number') return status
  }

  return undefined
}

export function getApiErrorResponseBody(
  error: unknown,
): string | object | undefined {
  // ECHO Law 6 trust-boundary: validate object shape before field access.
  if (!error || typeof error !== 'object') return undefined
  if (!('responseBody' in error)) return undefined
  return (error as { responseBody: string | object }).responseBody
}

export function hasParsedApiErrorDetails(
  details: ReturnType<typeof parseApiErrorResponseBody>,
): boolean {
  return (
    details.errorCode !== undefined ||
    details.message !== undefined ||
    details.countryCode !== undefined ||
    details.countryBlockReason !== undefined ||
    details.ipPrivacySignals !== undefined
  )
}

/**
 * Extracts HTTP status and structured server error fields from API errors,
 * including AI SDK RetryError wrappers whose useful APICallError is nested in
 * `lastError` / `errors`.
 */
export function extractApiErrorDetails(error: unknown): ApiErrorDetails {
  for (const candidate of getApiErrorCandidates(error)) {
    const statusCode = getApiErrorStatusCode(candidate)
    const parsed = parseApiErrorResponseBody(getApiErrorResponseBody(candidate))

    if (statusCode !== undefined || hasParsedApiErrorDetails(parsed)) {
      return {
        ...parsed,
        ...(statusCode !== undefined && { statusCode }),
      }
    }
  }

  return {}
}
