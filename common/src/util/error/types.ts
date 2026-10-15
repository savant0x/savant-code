export type ErrorOr<T, E extends ErrorObject = ErrorObject> =
  Success<T> | Failure<E>

export type Success<T> = {
  success: true
  value: T
}

export type Failure<E extends ErrorObject = ErrorObject> = {
  success: false
  error: E
}

/**
 * Result type for prompt functions that can be aborted.
 * Provides rich semantics to distinguish between successful completion and user abort.
 *
 * ## When to use `PromptResult<T>` vs `ErrorOr<T>`
 *
 * Use `PromptResult<T>` when:
 * - The operation can be cancelled by the user (via AbortSignal)
 * - An abort is an expected outcome, not an error
 * - You need to distinguish between errors (which might trigger fallbacks) and
 *   user-initiated aborts (which should propagate immediately)
 *
 * Use `ErrorOr<T>` when:
 * - The operation can fail with an error that should be handled
 * - There's no concept of user-initiated abort
 * - You want to return error details rather than throw
 *
 * ## Abort handling patterns
 *
 * 1. **Check and return early** - For graceful handling where abort means "stop, no error":
 *    ```ts
 *    const result = await promptAiSdk({ ... })
 *    if (result.aborted) return // or return null, false, etc.
 *    doSomething(result.value)
 *    ```
 *
 * 2. **Unwrap and throw** - For propagating aborts as exceptions:
 *    ```ts
 *    const value = unwrapPromptResult(await promptAiSdk({ ... }))
 *    // Throws if aborted, callers should use isAbortError() in catch blocks
 *    ```
 *
 * 3. **Rethrow in catch blocks** - Prevent swallowing abort errors:
 *    ```ts
 *    try {
 *      await someOperation()
 *    } catch (error) {
 *      if (isAbortError(error)) throw error // Don't swallow aborts
 *      // Handle other errors
 *    }
 *    ```
 */
export type PromptResult<T> = PromptSuccess<T> | PromptAborted

export type PromptSuccess<T> = {
  aborted: false
  value: T
}

export type PromptAborted = {
  aborted: true
  reason?: string
}

export type ErrorObject = {
  name: string
  message: string
  stack?: string
  /** HTTP status code from error.status (used by some libraries) */
  status?: number
  /** HTTP status code from error.statusCode (used by AI SDK and SavantCode errors) */
  statusCode?: number
  /** Optional machine-friendly error code, if available */
  code?: string
  /** Optional raw error object */
  rawError?: string
  /** Response body from API errors (AI SDK APICallError) */
  responseBody?: string
  /** URL that was called (API errors) */
  url?: string
  /** Whether the error is retryable (API errors) */
  isRetryable?: boolean
  /** Request body values that were sent (API errors) - stringified for safety */
  requestBodyValues?: string
  /** Cause of the error, if nested */
  cause?: ErrorObject
}
