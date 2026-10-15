import { isTransientNetworkError } from '@savant-code/common/util/error'
import { APICallError } from 'ai'

/**
 * Wrap global fetch so transient connection failures (socket closed/reset,
 * connection refused) are rethrown as retryable APICallErrors.
 *
 * Bun's fetch throws these as plain Errors ("The socket connection was closed
 * unexpectedly...", code ECONNRESET/ConnectionClosed), which the AI SDK does
 * not recognize as retryable — it only auto-retries APICallError with
 * isRetryable=true. Marking them retryable lets streamText's built-in
 * exponential backoff (default 2 retries) absorb brief server/network blips
 * instead of failing the whole agent run.
 */
export function fetchWithRetryableNetworkErrors(
  ...args: Parameters<typeof globalThis.fetch>
): ReturnType<typeof globalThis.fetch> {
  return globalThis.fetch(...args).catch((error) => {
    if (isTransientNetworkError(error)) {
      const input = args[0]
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      throw new APICallError({
        message: error instanceof Error ? error.message : String(error),
        cause: error,
        url,
        requestBodyValues: {},
        isRetryable: true,
      })
    }
    throw error
  })
}
