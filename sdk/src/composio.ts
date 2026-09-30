import { jsonToolResult } from '@savant-code/common/util/messages'

import type { ComposioMetaToolName } from '@savant-code/common/constants/composio'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'

/**
 * FID-2026-0929-005 (gut the backend): composio executed exclusively via the
 * SavantCode backend relay (POST /api/v1/composio/execute), which no longer
 * exists. The direct-mode short-circuit (FID-2026-0806-009) and the fetch
 * path are deleted; this is now an unconditional honest error, kept only so
 * the meta-tool vocabulary in `tool-call.ts` answers instead of pretending.
 */
export async function executeComposioToolViaServer(params: {
  toolName: ComposioMetaToolName
  input: Record<string, JSONValue>
}): Promise<ToolResultOutput[]> {
  void params
  return [
    {
      type: 'json',
      value: {
        errorMessage:
          'Composio is unavailable: it executed exclusively via the SavantCode backend, which does not exist.',
      },
    },
  ]
}

export const composioUnavailableHint = jsonToolResult({
  errorMessage:
    'Composio is unavailable: it executed exclusively via the SavantCode backend, which does not exist.',
})
