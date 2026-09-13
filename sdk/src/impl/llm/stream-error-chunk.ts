import { buildArray } from '@savant-code/common/util/array'
import { getErrorObject } from '@savant-code/common/util/error'
import {
  APICallError,
  InvalidToolInputError,
  NoSuchToolError,
  ToolCallRepairError,
  TypeValidationError,
} from 'ai'

import { normalizeNativeToolCallStreamError } from './errors'

/**
 * FID-2026-0913-002: pure error-branch helpers extracted from
 * `promptAiSdkStream` when the module hit the 300-line ceiling. The
 * generator in `stream.ts` keeps the `yield`/`yield*` authority — these
 * functions only decide WHAT happens; `stream.ts` performs it.
 */

/** The fullStream error-chunk shape this module inspects (`error` is opaque). */
type AiSdkErrorChunk = {
  type: 'error'
  error: unknown
  [key: string]: unknown
}

/**
 * The OpenAI-compatible provider uses a typed object for incomplete native
 * arguments so this path never relies on parsing a user-facing message.
 * Returns null for non-object errors and hostile shapes (the factory's own
 * contract).
 */
export function classifyNativeToolCallError(
  error: unknown,
): ReturnType<typeof normalizeNativeToolCallStreamError> {
  if (typeof error !== 'object' || error === null) return null
  return normalizeNativeToolCallStreamError(error)
}

/**
 * Assemble the agent-facing message: the error's own message plus the API
 * response body when the error is an APICallError.
 */
export function buildStreamErrorMessage(chunk: AiSdkErrorChunk): string {
  const errorBody = APICallError.isInstance(chunk.error)
    ? chunk.error.responseBody
    : undefined
  const mainErrorMessage =
    chunk.error instanceof Error
      ? chunk.error.message
      : typeof chunk.error === 'string'
        ? chunk.error
        : JSON.stringify(chunk.error)
  return buildArray([mainErrorMessage, errorBody]).join('\n')
}

/**
 * Tool-call failures passed back to the agent so it can see what went wrong
 * and retry. Note: If you find any other error types that should be passed
 * through to the agent, add them here!
 */
export function isAgentRetryableToolError(error: unknown): boolean {
  return (
    NoSuchToolError.isInstance(error) ||
    InvalidToolInputError.isInstance(error) ||
    ToolCallRepairError.isInstance(error) ||
    TypeValidationError.isInstance(error)
  )
}

/**
 * FID-2026-0912-005: vendor SDK transformers (e.g. @ai-sdk/anthropic,
 * @ai-sdk/google) emit tool-call parts unconditionally — including parts
 * that `ai` core has marked `invalid: true` (unparseable args, unknown tool)
 * and filtered from execution. Forwarding them raw degrades into a generic
 * tool-error in the runtime, bypassing the native-incomplete machinery
 * (tool-specific steering, strike counting with exhaustion, and the
 * PostToolUseFailure ledger record). The OpenAI-compatible family gets this
 * classification from our own flush gate; vendor families get it here.
 * Reuses the one message factory (Law 13). Returns null for a hostile
 * non-string toolName shape — the caller fails closed (Law 14).
 */
export function classifyInvalidToolCall(chunk: {
  toolName: unknown
}): ReturnType<typeof normalizeNativeToolCallStreamError> {
  const toolName =
    typeof chunk.toolName === 'string' ? chunk.toolName : 'unknown'
  return normalizeNativeToolCallStreamError({
    type: 'native-incomplete',
    toolName,
  })
}

/**
 * Redacted log fields shared by the warn/error paths: the chunk is logged
 * with its `error` stripped (it is logged separately via getErrorObject)
 * so log lines never grow the full serialized error twice. Accepts any
 * fullStream chunk shape carrying an `error` field (error chunks and
 * invalid tool-call parts alike).
 */
export function streamErrorLogFields(
  chunk: { error?: unknown; [key: string]: unknown },
  model: unknown,
): { chunk: Record<string, unknown>; error: unknown; model: unknown } {
  return {
    chunk: { ...chunk, error: undefined },
    error: getErrorObject(chunk.error),
    model,
  }
}
