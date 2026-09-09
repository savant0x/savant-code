// FID-2026-0907-006 — answer-extraction seam, moved verbatim from
// headless-run.ts (300-line ceiling pressure; Law 13 re-export hub pattern
// from FID-2026-0819-005). Pure functions; no behavioral change.

import type { RunState } from '@savant-code/sdk'

function isTextPart(part: unknown): part is { type: 'text'; text: string } {
  return (
    part !== null &&
    typeof part === 'object' &&
    (part as { type?: unknown }).type === 'text' &&
    typeof (part as { text?: unknown }).text === 'string'
  )
}

function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter(isTextPart)
    .map((part) => part.text)
    .join('')
}

/** Last assistant message with non-empty text, scanning backwards. */
function lastAssistantText(messages: unknown[] | undefined): string {
  if (!messages || messages.length === 0) return ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as { role?: string; content?: unknown }
    if (message?.role !== 'assistant') continue
    const text = textFromContent(message.content)
    if (text.trim().length > 0) return text
  }
  return ''
}

/**
 * Extract the final answer from a completed RunState. Prefers the run output
 * (lastMessage/allMessages), then the full session message history.
 */
export function extractFinalAnswer(runState: RunState): string {
  const output = runState.output
  if (output) {
    if (output.type === 'lastMessage' || output.type === 'allMessages') {
      const fromOutput = lastAssistantText(output.value as unknown[])
      if (fromOutput) return fromOutput
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
    runState.sessionState?.mainAgentState?.messageHistory as
      unknown[] | undefined,
  )
}
