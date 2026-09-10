/**
 * OAuth stream-error classification for the LLM entry points
 * (FID-2026-0805-003). Extracted from impl/llm.ts verbatim.
 */

import { isNativeToolCallError } from '@savant-code/common/types/contracts/llm'

import { getErrorStatusCode } from '../../error-utils'

import type {
  NativeToolCallError,
  StreamErrorChunk,
} from '@savant-code/common/types/contracts/llm'

/**
 * Shared OAuth error classifier (FID-2026-0803-003 SDK-4): matches a status
 * code OR any keyword in the message/response body.
 */
function isOAuthError<T>(
  error: T,
  params: { statuses: number[]; keywords: string[] },
): boolean {
  if (!error || typeof error !== 'object') return false

  // Check status code (handles both 'status' from AI SDK and 'statusCode' from our errors)
  const statusCode = getErrorStatusCode(error)
  if (statusCode !== undefined && params.statuses.includes(statusCode)) {
    return true
  }

  // Check error message / response body for the keyword set
  const err = error as { message?: string; responseBody?: string }
  const message = (err.message || '').toLowerCase()
  const responseBody = (err.responseBody || '').toLowerCase()

  return params.keywords.some(
    (keyword) => message.includes(keyword) || responseBody.includes(keyword),
  )
}

/**
 * Check if an error is an OAuth rate limit error that should trigger fallback.
 */
function isOAuthRateLimitError<T>(error: T): boolean {
  return isOAuthError(error, {
    statuses: [429],
    keywords: ['rate_limit', 'rate limit'],
  })
}

/**
 * Check if an error is an OAuth authentication error (expired/invalid token).
 * This indicates we should try refreshing the token.
 */
function isOAuthAuthError<T>(error: T): boolean {
  return isOAuthError(error, {
    statuses: [401, 403],
    keywords: ['unauthorized', 'invalid_token', 'authentication', 'expired'],
  })
}

export type ChatGptOAuthStreamErrorPolicy =
  'fallback-rate-limit' | 'fail-auth-reconnect' | 'fail-fast' | 'ignore'

export function classifyChatGptOAuthStreamError<T>(params: {
  isChatGptOAuth: boolean
  skipChatGptOAuth?: boolean
  hasYieldedContent: boolean
  error: T
}): ChatGptOAuthStreamErrorPolicy {
  const { isChatGptOAuth, skipChatGptOAuth, hasYieldedContent, error } = params

  if (!isChatGptOAuth || skipChatGptOAuth || hasYieldedContent) {
    return 'ignore'
  }

  if (isOAuthRateLimitError(error)) {
    return 'fallback-rate-limit'
  }

  if (isOAuthAuthError(error)) {
    return 'fail-auth-reconnect'
  }

  return 'fail-fast'
}

export function normalizeNativeToolCallStreamError(
  value: object,
): Extract<StreamErrorChunk, { errorClass: 'native-incomplete' }> | null {
  if (!isNativeToolCallError(value)) {
    return null
  }

  const nativeError: NativeToolCallError = value
  // FID-2026-0909-008: a 'length' finish reason means the output budget
  // was exhausted mid-argument — re-sending the same payload truncates
  // again. Steer to split payloads instead of a straight retry.
  const isOutputCapHit = nativeError.finishReason === 'length'
  const message = isOutputCapHit
    ? `Incomplete arguments for tool ${nativeError.toolName}: the output token limit was reached before the arguments finished. Split the work into smaller calls — keep each call's arguments compact.`
    : `Incomplete arguments for tool ${nativeError.toolName}; retry the tool call with a complete arguments object.`
  return {
    type: 'error',
    message,
    errorClass: 'native-incomplete',
    toolName: nativeError.toolName,
    ...(nativeError.finishReason !== undefined && {
      finishReason: nativeError.finishReason,
    }),
  }
}
