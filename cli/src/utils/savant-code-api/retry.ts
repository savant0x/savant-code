import type { RetryConfig } from './types'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Build a JSON request body by dropping keys with `undefined` values.
 * Values are known to be JSON-serializable because they come from typed
 * request objects, so the cast to `Record<string, JSONValue>` is safe.
 */
export function buildRequestBody<
  T extends Record<string, JSONValue | undefined>,
>(obj: T): Record<string, JSONValue> {
  const result: Record<string, JSONValue> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}

const TLS_CERTIFICATE_ERROR_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_HAS_EXPIRED',
])

export function getTlsCertificateError(error: Error, depth = 0): Error | null {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : undefined
  const message = error.message.toLowerCase()
  if (
    (code && TLS_CERTIFICATE_ERROR_CODES.has(code)) ||
    message.includes('self signed certificate') ||
    message.includes('unable to verify the first certificate') ||
    message.includes('certificate has expired') ||
    message.includes('certificate verify failed')
  ) {
    return error
  }

  if (depth >= 2 || !(error.cause instanceof Error)) {
    return null
  }

  return getTlsCertificateError(error.cause, depth + 1)
}

export function formatNetworkErrorMessage(
  error: Error,
  method: string,
  url: string,
) {
  const requestUrl = new URL(url)
  const tlsCertificateError = getTlsCertificateError(error)

  if (tlsCertificateError) {
    return [
      `TLS certificate verification failed for ${requestUrl.origin}.`,
      'If your network intercepts HTTPS traffic, install its root certificate into your system trust store or use a network path that does not intercept TLS.',
      `Original error: ${tlsCertificateError.message} (${method} ${url})`,
    ].join(' ')
  }

  return `${error.message} (${method} ${url})`
}

/**
 * Sleep for a given duration — re-exported from the canonical home
 * (FID-2026-0928-009: one body in `common/util/promise`); the module-local
 * import path is preserved for existing consumers.
 */
export { sleep } from '@savant-code/common/util/promise'

/**
 * Calculate delay with exponential backoff and jitter
 */
export const calculateBackoffDelay = (
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
): number => {
  const exponentialDelay = initialDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs)
}

/**
 * Check if an error is retryable (network errors).
 *
 * Note: AbortError is NOT retryable because it indicates intentional cancellation
 * (e.g., user cancelled the request or our timeout was exceeded).
 */
export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const name = error.name.toLowerCase()
    const message = error.message.toLowerCase()

    // Don't retry abort errors - they indicate intentional cancellation
    if (name === 'aborterror') {
      return false
    }
    if (getTlsCertificateError(error)) {
      return false
    }

    return (
      name === 'timeouterror' ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    )
  }
  return false
}
