import { toolNames } from '@savant-code/common/tools/constants'
import { userMessage } from '@savant-code/common/util/messages'

import { getSteeringMessage } from '../../run-agent-step/constants'
import { withSystemTags } from '../../util/messages'

import type { AgentTemplate } from '../../templates/types'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { StreamErrorChunk } from '@savant-code/common/types/contracts/llm'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { WriteToolName } from '@savant-code/common/types/provenance'

/** FID-2026-0816-012: native tools whose arguments are commonly large enough to
 *  truncate mid-stream on flash-class models. Recovery steers the model to
 *  split these instead of re-emitting the same oversized payload. The write
 *  tools reuse the canonical `WriteToolName` union (Law 13 — one source of
 *  truth); `read_files` joins it for multi-path reads; `run_terminal_command`
 *  joins it because chained bash commands routinely truncate the same way. */
const NATIVE_TOOL_CALL_STEER_SPLIT_TOOLS = new Set<
  WriteToolName | 'read_files' | 'run_terminal_command'
>([
  'write_file',
  'str_replace',
  'apply_patch',
  'read_files',
  'run_terminal_command',
])

/**
 * Handles a stream error chunk (FID-2026-0819-005 Loop 299: extracted
 * verbatim from `tools/stream-parser.ts`'s stream consumption loop).
 *
 * Pushes the TOOL_CALL_ERROR message — including the FID-2026-0816-012
 * provider-drift warning and the FID-2026-0819-004 tool-specific steering
 * suffix — into `errorMessages`, and reports whether a native-incomplete
 * tool call was observed (plus its tool name) so the caller can set its
 * result fields.
 */
export function handleStreamErrorChunk(params: {
  chunk: StreamErrorChunk
  errorMessages: Message[]
  loggerWarn: (payload: unknown, message: string) => void
  agentTemplate: AgentTemplate
  runId: string
}): {
  hasNativeIncompleteToolCall: boolean
  lastIncompleteToolName: string | undefined
} {
  const { chunk, errorMessages, loggerWarn, agentTemplate, runId } = params
  let hasNativeIncompleteToolCall = false
  let lastIncompleteToolName: string | undefined
  if ('errorClass' in chunk && chunk.errorClass === 'native-incomplete') {
    hasNativeIncompleteToolCall = true
    lastIncompleteToolName = chunk.toolName
    // FID-2026-0816-012 step 4: an incomplete native call for a tool
    // unknown to the runtime is provider-tool-set drift, not model
    // truncation — surface it so it is observable instead of being
    // misread as a payload-size problem.
    if (
      chunk.toolName !== undefined &&
      !toolNames.includes(chunk.toolName as ToolName)
    ) {
      loggerWarn(
        {
          agentType: agentTemplate.id,
          runId,
          toolName: chunk.toolName,
        },
        'Native tool call flagged incomplete for a tool unknown to the runtime (possible provider tool-set drift)',
      )
    }
  }
  // FID-2026-0819-004: tool-specific steering with progressive
  // escalation. Strike 1 = hint, strike 2 = explicit, 3+ = example.
  // We use strike=1 here (first occurrence); loop-iteration.ts may
  // append a second error with escalating guidance on retries.
  const steering =
    'errorClass' in chunk &&
    chunk.errorClass === 'native-incomplete' &&
    chunk.toolName !== undefined &&
    NATIVE_TOOL_CALL_STEER_SPLIT_TOOLS.has(
      chunk.toolName as WriteToolName | 'read_files' | 'run_terminal_command',
    )
      ? getSteeringMessage(chunk.toolName, 1)
      : ''
  errorMessages.push(
    userMessage({
      content: withSystemTags(
        `Error during tool call: ${chunk.message}. Please check the tool name and arguments and try again.${steering}`,
      ),
      tags: ['TOOL_CALL_ERROR'],
    }),
  )
  return { hasNativeIncompleteToolCall, lastIncompleteToolName }
}
