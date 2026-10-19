// FID-2026-0907-006 — answer-extraction seam, moved verbatim from
// headless-run.ts (300-line ceiling pressure; Law 13 re-export hub pattern
// from FID-2026-0819-005). Pure functions; no behavioral change.

import { getLastAssistantTurnMessages } from '@savant-code/agent-runtime/util/agent-output'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { RunState } from '@savant-code/sdk'

/** The stream persists consecutive assistant fragments within one turn. */
function lastAssistantText(messages: Message[] | undefined): string {
  return getLastAssistantTurnMessages(messages ?? [])
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.content)
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

/**
 * Extract the final answer from a completed RunState. Prefers the run output
 * (lastMessage/allMessages), then the full session message history.
 */
export function extractFinalAnswer(runState: RunState): string {
  const output = runState.output
  if (output) {
    if (output.type === 'lastMessage' || output.type === 'allMessages') {
      const fromOutput = lastAssistantText(output.value)
      if (fromOutput.trim()) return fromOutput
    }
    if (output.type === 'structuredOutput' && output.value) {
      const value = output.value as Record<string, unknown>
      if (typeof value.message === 'string' && value.message.trim()) {
        return value.message
      }
      if (typeof value.summary === 'string' && value.summary.trim()) {
        return value.summary
      }
    }
  }
  return lastAssistantText(
    runState.sessionState?.mainAgentState?.messageHistory,
  )
}
