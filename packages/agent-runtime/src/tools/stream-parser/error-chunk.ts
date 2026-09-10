import { toolNames } from '@savant-code/common/tools/constants'
import { userMessage } from '@savant-code/common/util/messages'

import { getSteeringMessage } from '../../run-agent-step/constants'
import { withSystemTags } from '../../util/messages'

import type { AgentTemplate } from '../../templates/types'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { StreamErrorChunk } from '@savant-code/common/types/contracts/llm'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * FID-2026-0909-007: the shared wrap prefix for tool-call error messages.
 * The idempotence guard matches on it so a re-emitted, already-wrapped
 * error is never wrapped a second time (the observed doubled-suffix class:
 * one `Error during tool call:` prefix with the trailing suffix twice).
 */
export const TOOL_CALL_ERROR_MESSAGE_PREFIX = 'Error during tool call: '

/**
 * FID-2026-0909-007: wrap a raw tool-call error message exactly once.
 * Already-wrapped messages pass through as-is (any supplied steering
 * suffix is intentionally dropped — the pass-through message already
 * carries the steering from its first wrap); unwrapped messages gain the
 * single canonical wrapper (plus an optional steering suffix). One wrap
 * template for every emission site (Law 13). A trailing period on the
 * raw message is normalized so the join never produces a doubled `..`
 * (the SDK normalizer's messages all end with one).
 */
export function wrapToolCallErrorMessage(
  message: string,
  steeringSuffix = '',
): string {
  if (message.startsWith(TOOL_CALL_ERROR_MESSAGE_PREFIX)) {
    return message
  }
  const body = message.endsWith('.') ? message.slice(0, -1) : message
  return `${TOOL_CALL_ERROR_MESSAGE_PREFIX}${body}. Please check the tool name and arguments and try again.${steeringSuffix}`
}

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
  // FID-2026-0909-007: steering is ungated — every native-incomplete
  // chunk steers at strike 1. The old STEER_SPLIT_TOOLS Set duplicated
  // the map-plus-fallback policy that getSteeringMessage already encodes
  // (Law 13) and left unmapped tools with EMPTY guidance on the first,
  // most-important retry.
  const steering =
    'errorClass' in chunk &&
    chunk.errorClass === 'native-incomplete' &&
    chunk.toolName !== undefined
      ? getSteeringMessage(chunk.toolName, 1)
      : ''
  errorMessages.push(
    userMessage({
      content: withSystemTags(
        wrapToolCallErrorMessage(chunk.message, steering),
      ),
      tags: ['TOOL_CALL_ERROR'],
    }),
  )
  return { hasNativeIncompleteToolCall, lastIncompleteToolName }
}
