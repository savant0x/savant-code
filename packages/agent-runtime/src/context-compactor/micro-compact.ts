import { CompactionMessage_ } from './phases'
import { countTokensJson } from '../util/token-counter'

import type { MicroCompactResult } from './state'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'

/**
 * FID-2026-0814-004 H-01: build the micro-compact placeholder for a cleared
 * tool result. Verification tools (`run_readonly_command`, `run_terminal_command`)
 * carry a structured {command, stdout, stderr, exitCode} JSON value; wiping it
 * erased the one signal a verification agent needs (PASS/FAIL). The placeholder
 * preserves `exitCode` + `command` as a tiny JSON object — the token savings
 * still come from dropping stdout/stderr. Non-JSON values fall back to the
 * legacy `[compacted]` sentinel (renderer-compatible).
 */
export function buildCompactedToolValue(
  toolName: string | undefined,
  content: ToolMessage['content'],
): JSONValue {
  const isVerificationTool =
    toolName === 'run_readonly_command' || toolName === 'run_terminal_command'
  const jsonPart = content.find(
    (part): part is Extract<ToolResultOutput, { type: 'json' }> =>
      part.type === 'json',
  )
  if (
    !isVerificationTool ||
    !jsonPart ||
    typeof jsonPart.value !== 'object' ||
    jsonPart.value === null
  ) {
    return '[compacted]'
  }
  const value = jsonPart.value as Record<string, unknown>
  return {
    compacted: true,
    command: typeof value.command === 'string' ? value.command : undefined,
    exitCode: typeof value.exitCode === 'number' ? value.exitCode : undefined,
  } as JSONValue
}

/**
 * Layer 2 pass: micro-compact — clear stale tool results before each API call.
 * Zero API cost. Clears tool results older than the N most recent, where
 * N = maxKeepRecent (default 3).
 *
 * Safety: Only clears tool results where the paired tool_use has been
 * processed (tool_result exists). Prevents orphaned references.
 */
export function runMicroCompact(params: {
  messages: Message[]
  contextTokenCount?: number
  enabled: boolean
  maxKeepRecent: number
  floorTokens: number | undefined
  logger: Logger
}): MicroCompactResult {
  const {
    messages,
    contextTokenCount,
    enabled,
    maxKeepRecent,
    floorTokens,
    logger,
  } = params
  // FID-2026-0814-004 H-05: the operator's `compression.microCompact`
  // off-switch. Off = never clear tool results (evidence preservation).
  if (!enabled) {
    return { messages, tokensSaved: 0, messagesCleared: 0 }
  }
  const compacted: Message[] = []
  const toolResultIndices: number[] = []

  // Find all tool result indices
  for (let i = 0; i < messages.length; i++) {
    if (CompactionMessage_.isToolResult(messages[i])) {
      toolResultIndices.push(i)
    }
  }

  // If fewer tool results than threshold, nothing to compact
  if (toolResultIndices.length <= maxKeepRecent) {
    return { messages, tokensSaved: 0, messagesCleared: 0 }
  }

  // FID-2026-0814-004 H-06: pressure gate. Below the configured floor the
  // compactor keeps ALL evidence — verification-heavy runs at low context
  // must not have their results erased just because the count exceeds 3.
  if (
    floorTokens !== undefined &&
    contextTokenCount !== undefined &&
    contextTokenCount < floorTokens
  ) {
    return { messages, tokensSaved: 0, messagesCleared: 0 }
  }

  // Keep all non-tool messages and the N most recent tool results
  const keepRecent = toolResultIndices.slice(-maxKeepRecent)
  // FID-2026-0815-006 (F-08): Set membership makes the keep-recent test
  // O(1) instead of the O(n·k) `keepRecent.includes` scan.
  const keepRecentSet = new Set(keepRecent)
  const clearSet = new Set(
    toolResultIndices.filter((idx) => !keepRecentSet.has(idx)),
  )

  let actualMessagesCleared = 0
  let actualTokensSaved = 0

  for (let i = 0; i < messages.length; i++) {
    if (clearSet.has(i)) {
      // Replace with a minimal placeholder that preserves the slot.
      // clearSet is derived from toolResultIndices, so every cleared slot
      // is a ToolMessage — re-check with the type guard so the narrowed
      // placeholder is well-typed (toolName/toolCallId are required on
      // ToolMessage).
      const source = messages[i]
      if (!CompactionMessage_.isToolResult(source)) continue
      // FID-2026-0814-004 H-01: preserve the machine-readable verification
      // signal across micro-compaction. run_readonly_command results carry
      // {command, stdout, stderr, exitCode}; wiping them makes the harness
      // fight itself (the A–Z agent re-ran ~12 commands to defeat this). The
      // placeholder keeps the exit code + command identity as a tiny JSON
      // object — the token savings still come from dropping stdout/stderr.
      const compactedValue = buildCompactedToolValue(
        source.toolName,
        source.content,
      )
      const compactedContent: ToolMessage['content'] = [
        { type: 'json', value: compactedValue },
      ]
      const originalTokens = countTokensJson(source.content)
      const replacementTokens = countTokensJson(compactedContent)
      // FID-2026-1013-010 W1-4: never replace a tiny tool result with a
      // placeholder that is equal or larger in tokens; only clear when the
      // placeholder genuinely saves tokens, and record the exact token delta.
      if (originalTokens <= replacementTokens) {
        compacted.push(source)
        continue
      }
      actualMessagesCleared += 1
      actualTokensSaved += originalTokens - replacementTokens
      compacted.push({
        role: 'tool',
        content: compactedContent,
        toolName: source.toolName,
        toolCallId: source.toolCallId,
      })
    } else {
      compacted.push(messages[i])
    }
  }

  const tokensSaved =
    actualMessagesCleared > 0
      ? Math.max(actualMessagesCleared, actualTokensSaved)
      : 0

  if (actualMessagesCleared > 0) {
    logger.debug(
      { messagesCleared: actualMessagesCleared, tokensSaved },
      'Micro-compact: cleared stale tool results',
    )
  }

  return {
    messages: compacted,
    tokensSaved,
    messagesCleared: actualMessagesCleared,
  }
}
