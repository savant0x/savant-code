import { userMessage } from '@savant-code/common/util/messages'

import { wrapToolCallErrorMessage } from './error-chunk'
import { withSystemTags } from '../../util/messages'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * Builds the response handler that captures tool events into
 * assistantMessages. When isXmlMode=true, also captures tool_result events for
 * interleaved ordering.
 * (FID-2026-0809-016: extracted from `tools/stream-parser.ts`.)
 */
export function createResponseHandler(params: {
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  errorMessages: Message[]
  markToolCallError: () => void
}): (chunk: string | PrintModeEvent) => void {
  const { onResponseChunk, errorMessages, markToolCallError } = params
  return (chunk: string | PrintModeEvent) => {
    if (typeof chunk !== 'string') {
      if (chunk.type === 'error') {
        markToolCallError()
        // FID-2026-0909-007: idempotent wrap — an already-wrapped message
        // (re-emitted through this relay) passes through once instead of
        // gaining a second suffix. Uses the shared wrap helper so the
        // wrap template has exactly one definition (Law 13).
        errorMessages.push(
          userMessage({
            content: withSystemTags(wrapToolCallErrorMessage(chunk.message)),
            tags: ['TOOL_CALL_ERROR'],
          }),
        )
      }
    }
    return onResponseChunk(chunk)
  }
}
