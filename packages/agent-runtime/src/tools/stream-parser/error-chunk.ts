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
  const errorClass = 'errorClass' in chunk ? chunk.errorClass : undefined
  const erroredToolName = 'toolName' in chunk ? chunk.toolName : undefined
  if (errorClass === 'native-incomplete' || errorClass === 'tool-unavailable') {
    hasNativeIncompleteToolCall = true
    lastIncompleteToolName = erroredToolName
    // FID-2026-0816-012 step 4: an incomplete native call for a tool
    // unknown to the runtime is provider-tool-set drift, not model
    // truncation — surface it so it is observable instead of being
    // misread as a payload-size problem.
    if (
      erroredToolName !== undefined &&
      !toolNames.includes(erroredToolName as ToolName)
    ) {
      loggerWarn(
        {
          agentType: agentTemplate.id,
          runId,
          toolName: erroredToolName,
        },
        'Native tool call flagged incomplete for a tool unknown to the runtime (possible provider tool-set drift)',
      )
    }
  }
  // FID-2026-1012-002: a tool name this AGENT does not have is a different
  // failure from a truncated payload, and the runtime can decide it here from
  // data it already holds — the errored name and the agent's own allowlist.
  // The pre-change check above compares against the runtime-wide catalog, so
  // `read_files` on a tool-restricted persona (`read_files` is in the catalog,
  // absent from the agent) produced no signal at all: the class was invisible
  // in logs, in the ledger, and in the steering text.
  const isUnavailableToolCall =
    erroredToolName !== undefined &&
    !agentTemplate.toolNames.includes(erroredToolName as ToolName)
  if (
    errorClass === 'tool-unavailable' ||
    (errorClass === 'native-incomplete' && isUnavailableToolCall)
  ) {
    loggerWarn(
      {
        agentType: agentTemplate.id,
        runId,
        toolName: erroredToolName,
        errorClass,
        availableTools: agentTemplate.toolNames,
      },
      'Model called a tool this agent does not have; reporting the unavailable-tool class instead of argument truncation',
    )
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
  // FID-2026-1012-002: for the unavailable-tool class the payload advice is
  // wrong by construction — the arguments were never the problem and the tool
  // cannot be called at all — so the corrective text names the tools the agent
  // actually has. The body is rewritten when the class was DERIVED (a provider
  // that reports the name-only failure as native-incomplete, whose own message
  // says "Incomplete arguments"); when the class arrived already honest
  // (`tool-unavailable`) its message is kept.
  const steering = isUnavailableToolCall
    ? ` Your available tools for this step are: ${agentTemplate.toolNames.length > 0 ? agentTemplate.toolNames.join(', ') : 'none'}. Call one of them — a tool outside that list cannot be used, and retrying it will not succeed.`
    : errorClass === 'native-incomplete' && erroredToolName !== undefined
      ? getSteeringMessage(erroredToolName, 1)
      : ''
  const body =
    errorClass === 'native-incomplete' && isUnavailableToolCall
      ? `Tool ${erroredToolName} is not available to this agent: the model called a tool that was not offered for this step.`
      : chunk.message
  errorMessages.push(
    userMessage({
      content: withSystemTags(wrapToolCallErrorMessage(body, steering)),
      tags: ['TOOL_CALL_ERROR'],
    }),
  )
  return { hasNativeIncompleteToolCall, lastIncompleteToolName }
}
