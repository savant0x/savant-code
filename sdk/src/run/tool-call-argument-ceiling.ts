import {
  MAX_ARGUMENT_CHARS,
  measureSerializedArguments,
} from '@savant-code/common/util/tool-argument-budget'

import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'

/**
 * FID-2026-1012-017: the pre-execution bound on one tool call's arguments.
 *
 * The per-tool budget stated to the model (`toolArgumentBudget`) is a planning
 * constraint; this is the ceiling the runtime enforces. A payload past it cannot
 * have been written deliberately — it is the shape the incomplete-arguments
 * class arrives in — so the call is refused before any executor, override or MCP
 * client runs and nothing is applied partially (Law 14). The volume is reported
 * in the error so the retry can be planned against a real number.
 *
 * Split out of `tool-call.ts` to keep that dispatcher inside the 300-line
 * quality ceiling (the same extraction pattern as `stream-error-chunk.ts`).
 */
export function refuseOversizedToolCall(params: {
  toolName: string
  input: Record<string, JSONValue>
}): { output: ToolResultOutput[] } | null {
  const serializedChars = measureSerializedArguments(params.input)
  if (serializedChars <= MAX_ARGUMENT_CHARS) return null
  return {
    output: [
      {
        type: 'json',
        value: {
          errorMessage:
            `${params.toolName}: this call carried ${serializedChars} characters of arguments, above the ` +
            `${MAX_ARGUMENT_CHARS}-character ceiling for a single tool call, so nothing was executed. ` +
            'Split the work across calls: create a file with write_file and append the rest with ' +
            'str_replace, read fewer files per call, and run one command per call.',
        },
      },
    ],
  }
}
