import { AbortError } from './abort'
import { getErrorObject } from './error-object'

import type {
  ErrorObject,
  Failure,
  PromptAborted,
  PromptResult,
  PromptSuccess,
  Success,
} from './types'

export function success<T>(value: T): Success<T> {
  return {
    success: true,
    value,
  }
}

export function failure(error: unknown): Failure<ErrorObject> {
  return {
    success: false,
    error: getErrorObject(error),
  }
}

/**
 * Create a successful prompt result.
 */
export function promptSuccess<T>(value: T): PromptSuccess<T> {
  return {
    aborted: false,
    value,
  }
}

/**
 * Create an aborted prompt result.
 */
export function promptAborted(reason?: string): PromptAborted {
  return {
    aborted: true,
    ...(reason !== undefined && { reason }),
  }
}

/**
 * Unwrap a PromptResult, returning the value if successful or throwing if aborted.
 *
 * Use this helper for consistent abort handling when you want aborts to propagate
 * as exceptions. Callers should use `isAbortError()` in catch blocks to detect
 * and handle abort errors appropriately (e.g., rethrow instead of logging as errors).
 *
 * @throws {AbortError} When result.aborted is true.
 */
export function unwrapPromptResult<T>(result: PromptResult<T>): T {
  if (result.aborted) {
    throw new AbortError(result.reason)
  }
  return result.value
}
