export const INITIAL_RETRY_DELAY = 1000 // 1 second

type RetryableErrorBase = {
  type?: string
  code?: string
  name?: string
  message?: string
}

export async function withRetry<
  T,
  E extends RetryableErrorBase = RetryableErrorBase,
>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    retryIf?: (error: E) => boolean
    onRetry?: (error: E, attempt: number) => void
    retryDelayMs?: number
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    retryIf = (error) => error.type === 'APIConnectionError',
    onRetry = () => {},
    retryDelayMs = INITIAL_RETRY_DELAY,
  } = options

  // FID-2026-0803-003 CMN-9: maxRetries=0 previously skipped the loop entirely
  // and the trailing `throw lastError` threw `null`. Always attempt at least once.
  const effectiveMaxRetries = Math.max(1, maxRetries)

  let lastError: E | null = null

  for (let attempt = 0; attempt < effectiveMaxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const typedError = error as E
      lastError = typedError

      if (!retryIf(typedError) || attempt === effectiveMaxRetries - 1) {
        throw typedError
      }

      onRetry(typedError, attempt + 1)

      // Exponential backoff with jitter (±20%) to prevent thundering herd
      const baseDelayMs = retryDelayMs * Math.pow(2, attempt)
      const jitter = 0.8 + Math.random() * 0.4 // Random multiplier between 0.8 and 1.2
      const delayMs = Math.round(baseDelayMs * jitter)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Optional message for the timeout error
 * @returns A promise that resolves with the result of the original promise or rejects with a timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = `Operation timed out after ${timeoutMs}ms`,
): Promise<T> {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)
  })

  // FID-2026-0803-003 CMN-10: clear the timer on every settle path (success or
  // rejection), not just success — a pending timer otherwise leaks the event loop.
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise,
  ])
}
