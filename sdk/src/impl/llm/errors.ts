/**
 * OAuth stream-error classification for the LLM entry points
 * (FID-2026-0805-003). Extracted from impl/llm.ts verbatim.
 */

import { isNativeToolCallError } from '@savant-code/common/types/contracts/llm'
import {
  describeArgumentBudget,
  toolArgumentBudget,
} from '@savant-code/common/util/tool-argument-budget'

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

/**
 * FID-2026-1012-002: the model named a tool the request never declared.
 *
 * This is a different failure from a truncated argument object, and the wording
 * must say so: no payload change can fix a tool that was not offered, and the
 * model can only recover by calling one of the tools it actually has. The
 * runtime pairs this message with a corrective retry (see
 * `tools/stream-parser/error-chunk.ts`) and a one-strike budget
 * (`run-agent-step/loop/native-strikes.ts`) instead of the three-strike
 * payload ladder.
 */
export function normalizeUnavailableToolStreamError(
  toolName: string,
): Extract<StreamErrorChunk, { errorClass: 'tool-unavailable' }> {
  return {
    type: 'error',
    message:
      `Tool ${toolName} is not available to this agent: the model called a tool ` +
      'that was not offered for this step. Use one of the tools provided in ' +
      "this step's tool list.",
    errorClass: 'tool-unavailable',
    toolName,
  }
}

/**
 * FID-2026-1012-009: the one piece of recovery advice for a cut payload.
 * Both truncation causes (a provider's output-cap finish reason, and a JSON
 * parse failure the classifier observed itself) prescribe the same action, so
 * the sentence is written once (Law 13) and composed with a truthful cause
 * clause rather than duplicated.
 */
const SPLIT_PAYLOAD_ADVICE =
  " Split the work into smaller calls — keep each call's arguments compact."

/**
 * FID-2026-1012-017: the advice for a rejection whose cause is NOT an observed
 * truncation — the arguments parsed but missed the schema, or nothing in the
 * stream says what happened. Schema recovery is preserved (the values must be
 * corrected), while the payload re-send that kept this class alive is not: a
 * payload large enough to have been cut would be cut again. Kept distinct from
 * `SPLIT_PAYLOAD_ADVICE` so a schema error is never reported as a size problem.
 */
const CORRECT_ARGUMENTS_ADVICE =
  ' Correct the argument values so they satisfy the tool schema, then re-emit the call once. If the arguments are large, divide the work across calls instead of sending the same payload again.'

export function normalizeNativeToolCallStreamError(
  value: object,
  options: { maxOutputTokens?: number } = {},
): Extract<StreamErrorChunk, { errorClass: 'native-incomplete' }> | null {
  if (!isNativeToolCallError(value)) {
    return null
  }

  const nativeError: NativeToolCallError = value
  // FID-2026-0909-008: a 'length' finish reason means the output budget
  // was exhausted mid-argument — re-sending the same payload truncates
  // again. Steer to split payloads instead of a straight retry.
  const isOutputCapHit = nativeError.finishReason === 'length'
  // FID-2026-1012-009: the vendor-SDK classification path has no finish reason
  // to offer, so it marks structural truncation itself (a JSON parse failure).
  // Both conditions select the same advice — one wording per class (Law 13) —
  // while the cause clause stays truthful about what was actually observed.
  const isTruncated = isOutputCapHit || nativeError.argumentsTruncated === true
  // FID-2026-1012-017: both truncation causes state the tool's real argument
  // budget, so the model plans a split against the number instead of re-sending
  // the payload that was already cut.
  const budgetClause = describeArgumentBudget(
    toolArgumentBudget({
      toolName: nativeError.toolName,
      maxOutputTokens: options.maxOutputTokens,
    }),
  )
  // FID-2026-1012-017 Loop 6: when the classifier could read the validation
  // failure, the recovery text names the field that failed instead of asking the
  // model to "correct the values" it had no way to identify. A truncated payload
  // never carries this clause (there is no parsed arguments object to reject).
  const schemaClause =
    !isTruncated && nativeError.schemaIssue !== undefined
      ? ` The arguments failed the tool schema at: ${nativeError.schemaIssue}.`
      : ''
  let message: string
  if (isOutputCapHit) {
    message = `Incomplete arguments for tool ${nativeError.toolName}: the output token limit was reached before the arguments finished.${SPLIT_PAYLOAD_ADVICE}${budgetClause}`
  } else if (isTruncated) {
    message = `Incomplete arguments for tool ${nativeError.toolName}: the arguments were cut off before they finished parsing.${SPLIT_PAYLOAD_ADVICE}${budgetClause}`
  } else {
    message = `Incomplete arguments for tool ${nativeError.toolName}: the provider rejected the call's arguments and nothing observed indicates truncation.${schemaClause}${CORRECT_ARGUMENTS_ADVICE}${budgetClause}`
  }
  return {
    type: 'error',
    message,
    errorClass: 'native-incomplete',
    toolName: nativeError.toolName,
    ...(nativeError.finishReason !== undefined && {
      finishReason: nativeError.finishReason,
    }),
    ...(isTruncated && { argumentsTruncated: true }),
  }
}
