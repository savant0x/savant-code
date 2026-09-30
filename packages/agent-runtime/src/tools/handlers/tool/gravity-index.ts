import { jsonToolResult } from '@savant-code/common/util/messages'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

/**
 * FID-2026-0929-005 (gut the backend): the gravity_index tool executed via
 * the SavantCode web API (POST /api/v1/gravity-index) — a backend that does
 * not exist. The web-API client (savant-code-web-api.ts) is deleted; the
 * tool name survives in the vocabulary, so this handler answers honestly
 * instead of attempting a network call or pretending to search.
 */
export const handleGravityIndex = (async (params: {
  toolCall: SavantCodeToolCall<'gravity_index'>
  previousToolCallFinished: Promise<void>
}): Promise<{
  output: SavantCodeToolOutput<'gravity_index'>
  creditsUsed: number
}> => {
  await params.previousToolCallFinished
  return {
    output: jsonToolResult({
      errorMessage:
        'gravity_index is unavailable: it executed via the SavantCode backend, which does not exist (FID-2026-0929-005). Use the gravity_index tool surfaced by your client harness if one is available.',
    }),
    creditsUsed: 0,
  }
}) satisfies SavantCodeToolHandlerFunction<'gravity_index'>
