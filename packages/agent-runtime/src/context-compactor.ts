/**
 * ContextCompactor — Runtime service for progressive context compaction.
 *
 * FID-2026-0725-085: Four-layer progressive auto-compaction system.
 * This class provides Layers 2-4:
 * - Layer 2 (MicroCompact): Per-turn tool result clearing, zero API cost
 * - Layer 3 (AutoCompact): Full LLM summarization triggered at token threshold
 * - Layer 4 (ReactiveCompact): Emergency truncation on API prompt-too-long error
 *
 * Layer 1 (SNPE) is user-initiated via /compact command, handled separately.
 *
 * FID-2026-0809-015: partial decomposition — `context-compactor/{state,circuit-breaker,phases}`
 * hold the state types, the circuit breaker, and the phase helpers; the
 * ContextCompactor class body itself remains in this file (Law 4 — zero
 * consumer changes).
 */

import { CircuitBreaker } from './context-compactor/circuit-breaker'
import {
  CompactionMessage_,
  isPromptTooLongError,
} from './context-compactor/phases'
import { AUTO_COMPACT_BUFFER } from './context-compactor/state'

import type {
  AutoCompactCheck,
  CompactorOptions,
  MicroCompactResult,
  ReactiveCompactResult,
  Thresholds,
} from './context-compactor/state'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'

export {
  AUTO_COMPACT_BUFFER,
  CIRCUIT_BREAKER_COOLDOWN_MS,
  CIRCUIT_BREAKER_MAX_FAILURES,
} from './context-compactor/state'

export { CompactionMessage_ } from './context-compactor/phases'

export type {
  AutoCompactCheck,
  CircuitState,
  CompactorOptions,
  MicroCompactResult,
  ReactiveCompactResult,
  Thresholds,
} from './context-compactor/state'

// FID-2026-0802-005 L8: compaction operations now operate on the canonical
// `Message` type directly — the previous `CompactionMessage` loose twin forced
// `as unknown as CompactionMessage[]` casts at every call site in
// run-agent-step.ts. The Message type lives in common, so importing it here
// introduces no circularity.

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

export class ContextCompactor {
  private logger: Logger
  private contextWindow: number
  private model: string
  private thresholds: Thresholds
  /** FID-2026-0814-004 H-05: micro-compact off-switch (config `microCompact`). */
  private readonly microCompactEnabled: boolean
  /** FID-2026-0814-004 H-06: optional token floor for the pressure gate. */
  private readonly microCompactFloorTokens: number | undefined

  private circuitBreaker: CircuitBreaker

  // P3b (FID-2026-0806-003): anti-thrash scoring. A preflight threshold
  // crossing only ARMS a pending score; the effectiveness of the compaction
  // that followed is judged against the REAL post-response token count when
  // it arrives at the next step boundary (Hermes's hard-won guard — never
  // score in the preflight estimate, never analytically, tokenizer skew
  // silently disables compaction otherwise).
  private awaitingCompactionScore = false

  constructor(options: CompactorOptions) {
    this.logger = options.logger
    // FID-2026-0814-006: fail loudly instead of silently defaulting the
    // context window. An unresolved window makes the display percent and the
    // pruner trigger diverge from the CLI-resolved window (the operator's
    // "93% vs 188.3k/262.1k" mismatch). The 200k fallback remains as the
    // last-resort value, but the divergence is now surfaced as a warning.
    this.contextWindow = options.contextWindow ?? 200_000
    if (options.contextWindow === undefined) {
      this.logger.warn(
        {
          fallbackContextWindow: this.contextWindow,
        },
        'contextWindow was not resolved; falling back to 200_000. ' +
          'Display percent and pruner trigger may diverge from the CLI-resolved window.',
      )
    }
    this.model = options.model ?? 'unknown'
    this.circuitBreaker = new CircuitBreaker(this.logger)
    // FID-2026-0814-004 H-05/H-06: config-driven micro-compact behavior.
    this.microCompactEnabled = options.microCompactEnabled ?? true
    this.microCompactFloorTokens = options.microCompactFloorTokens

    // Calculate thresholds based on context window
    this.thresholds = {
      autoCompact: Math.max(this.contextWindow - AUTO_COMPACT_BUFFER, 100_000),
      reactiveCompact: this.contextWindow,
      microCompactMaxKeepRecent: options.microCompactMaxKeepRecent ?? 6,
    }

    this.logger.debug(
      {
        contextWindow: this.contextWindow,
        model: this.model,
        autoCompactThreshold: this.thresholds.autoCompact,
        reactiveCompactThreshold: this.thresholds.reactiveCompact,
      },
      'ContextCompactor initialized',
    )
  }

  /**
   * Get the configured thresholds.
   */
  getThresholds(): Thresholds {
    // FID-2026-0815-006 (F-07): return the immutable internal reference
    // instead of a fresh spread. `this.thresholds` is assigned once in the
    // constructor and never mutated; every consumer (context-tokens.ts,
    // loop-context.ts, and the test suites) is read-only (Law-4 verified).
    return this.thresholds
  }

  /**
   * Layer 2: Micro-compact — clear stale tool results before each API call.
   *
   * Zero API cost. Clears tool results older than the N most recent,
   * where N = microCompactMaxKeepRecent (default 3).
   *
   * Safety: Only clears tool results where the paired tool_use has been
   * processed (tool_result exists). Prevents orphaned references.
   */
  microCompact(
    messages: Message[],
    contextTokenCount?: number,
  ): MicroCompactResult {
    // FID-2026-0814-004 H-05: the operator's `compression.microCompact`
    // off-switch. Off = never clear tool results (evidence preservation).
    if (!this.microCompactEnabled) {
      return { messages, tokensSaved: 0, messagesCleared: 0 }
    }
    const originalCount = messages.length
    const compacted: Message[] = []
    const toolResultIndices: number[] = []

    // Find all tool result indices
    for (let i = 0; i < messages.length; i++) {
      if (CompactionMessage_.isToolResult(messages[i])) {
        toolResultIndices.push(i)
      }
    }

    // If fewer tool results than threshold, nothing to compact
    if (toolResultIndices.length <= this.thresholds.microCompactMaxKeepRecent) {
      return { messages, tokensSaved: 0, messagesCleared: 0 }
    }

    // FID-2026-0814-004 H-06: pressure gate. Below the configured floor the
    // compactor keeps ALL evidence — verification-heavy runs at low context
    // must not have their results erased just because the count exceeds 3.
    if (
      this.microCompactFloorTokens !== undefined &&
      contextTokenCount !== undefined &&
      contextTokenCount < this.microCompactFloorTokens
    ) {
      return { messages, tokensSaved: 0, messagesCleared: 0 }
    }

    // Keep all non-tool messages and the N most recent tool results
    const keepRecent = toolResultIndices.slice(
      -this.thresholds.microCompactMaxKeepRecent,
    )
    // FID-2026-0815-006 (F-08): Set membership makes the keep-recent test
    // O(1) instead of the O(n·k) `keepRecent.includes` scan.
    const keepRecentSet = new Set(keepRecent)
    const clearSet = new Set(
      toolResultIndices.filter((idx) => !keepRecentSet.has(idx)),
    )

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
        compacted.push({
          role: 'tool',
          content: [{ type: 'json', value: compactedValue }],
          toolName: source.toolName,
          toolCallId: source.toolCallId,
        })
      } else {
        compacted.push(messages[i])
      }
    }

    const messagesCleared = originalCount - compacted.length + clearSet.size
    // Rough token estimate: ~4 chars per token
    const tokensSaved = messagesCleared * 200 // ~200 tokens per compacted tool result

    if (clearSet.size > 0) {
      this.logger.debug(
        { messagesCleared: clearSet.size, tokensSaved },
        'Micro-compact: cleared stale tool results',
      )
    }

    return { messages: compacted, tokensSaved, messagesCleared: clearSet.size }
  }

  /**
   * Layer 3: Auto-compact check — should we trigger full LLM summarization?
   *
   * Returns whether the context exceeds the auto-compact threshold.
   * The actual summarization is handled by the context-pruner agent spawn
   * in handleSteps (savant.ts).
   */
  shouldAutoCompact(
    messages: Message[],
    contextTokenCount: number,
  ): AutoCompactCheck {
    // Check circuit breaker
    const breaker = this.circuitBreaker.checkCooldown()
    if (!breaker.allowed) {
      return { shouldCompact: false, reason: breaker.reason }
    }

    const percentUsed = Math.round(
      (contextTokenCount / this.thresholds.autoCompact) * 100,
    )

    if (contextTokenCount >= this.thresholds.autoCompact) {
      // P3b: arm the anti-thrash score. The compaction the caller triggers
      // (context-pruner spawn) will be judged when the real post-response
      // count arrives at the next step boundary — see
      // scoreCompactionEffectiveness.
      this.awaitingCompactionScore = true
      return {
        shouldCompact: true,
        reason: `Context at ${percentUsed}% (${contextTokenCount.toLocaleString()} / ${this.thresholds.autoCompact.toLocaleString()} tokens)`,
        percentUsed,
      }
    }

    return { shouldCompact: false, percentUsed }
  }

  /**
   * P3b (FID-2026-0806-003): score the pending compaction against the REAL
   * post-response token count. Called once per step boundary (prepareStepContext)
   * BEFORE the fresh preflight check, so a compaction that ran during the
   * previous step is judged by whether it actually got the prompt under the
   * auto-compact threshold — not by any estimate made before it ran.
   *
   * A no-op when no compaction was armed (awaitingCompactionScore false), so
   * a summary-free step never resets the breaker.
   */
  scoreCompactionEffectiveness(realPostResponseTokenCount: number): void {
    if (!this.awaitingCompactionScore) return
    this.awaitingCompactionScore = false

    const succeeded = realPostResponseTokenCount < this.thresholds.autoCompact
    this.circuitBreaker.recordResult(succeeded)

    if (succeeded) {
      this.logger.debug(
        {
          realTokenCount: realPostResponseTokenCount,
          autoCompactThreshold: this.thresholds.autoCompact,
        },
        'Anti-thrash: compaction verified effective against real post-response count',
      )
    } else {
      this.logger.warn(
        {
          realTokenCount: realPostResponseTokenCount,
          autoCompactThreshold: this.thresholds.autoCompact,
        },
        'Anti-thrash: compaction did NOT get context under the threshold — re-compaction loop risk, scoring as failure',
      )
    }
  }

  /**
   * Layer 4: Reactive compact — emergency truncation on prompt-too-long error.
   *
   * Preserves: first message (system/instructions), last 20% of messages
   * (minimum 2), any messages with images (multimodal context), and any
   * compaction-summary / preserved-state messages (FID-2026-0806-003 Phase 1
   * P1b — the structured state must survive emergency truncation, not just
   * the pruner path). Retries API call once after truncation.
   */
  reactiveCompact(messages: Message[]): ReactiveCompactResult {
    if (messages.length <= 2) {
      return {
        truncated: false,
        messages,
        tokensSaved: 0,
        messagesRemoved: 0,
      }
    }

    // Preserve first message
    const firstMessage = messages[0]

    // Preserve last 20% (minimum 2)
    const keepFromEnd = Math.max(2, Math.floor(messages.length * 0.2))
    const lastMessages = messages.slice(-keepFromEnd)

    // FID-2026-0815-006 (F-06): single forward walk builds the preserved-index
    // set and the ordered image / preserved-state / critical lists, replacing
    // the previous three `filter` passes plus the repeated `indexOf` scans.
    const imageMessages: Message[] = []
    const preservedStateMessages: Message[] = []
    const criticalMessages: Message[] = []
    const preservedIndices = new Set<number>([0]) // first message
    const lastStartIndex = messages.length - keepFromEnd
    for (let i = 0; i < messages.length; i++) {
      if (i >= lastStartIndex) {
        preservedIndices.add(i)
      }
      const msg = messages[i]
      const content = msg.content
      // Preserve messages with images (multimodal). 'image_url' was a
      // loose-shape legacy check from the pre-Message CompactionMessage type.
      const hasImage =
        typeof content !== 'string' &&
        Array.isArray(content) &&
        content.some((part) => part.type === 'image')
      if (hasImage) {
        imageMessages.push(msg)
        preservedIndices.add(i)
      }
      // P1b (FID-2026-0806-003): preserve compaction-summary / preserved-state
      // messages (at most one <conversation_summary> at any time).
      if (CompactionMessage_.hasPreservedState(msg)) {
        preservedStateMessages.push(msg)
        preservedIndices.add(i)
      }
      // FID-2026-0806-005 Layer 3: preserve protocol-refresh messages.
      if (CompactionMessage_.hasCriticalContext(msg)) {
        criticalMessages.push(msg)
        preservedIndices.add(i)
      }
    }

    // Middle-preserved messages (images / preserved-state / critical-context)
    // not already covered by the first-message or last-20% slots, deduplicated
    // and in original order. Set membership makes the dedupe and the last-20%
    // exclusion O(1) per element.
    const lastMessagesSet = new Set<Message>(lastMessages)
    const seen = new Set<Message>()
    const reAddedPreserved: Message[] = []
    for (const msg of [
      ...imageMessages,
      ...preservedStateMessages,
      ...criticalMessages,
    ]) {
      if (seen.has(msg) || msg === firstMessage || lastMessagesSet.has(msg)) {
        continue
      }
      seen.add(msg)
      reAddedPreserved.push(msg)
    }

    const truncated = [
      firstMessage,
      ...messages
        .filter((_, idx) => !preservedIndices.has(idx) && idx !== 0)
        .slice(0, Math.floor(messages.length * 0.1)), // Keep 10% of middle for context
      ...reAddedPreserved,
      ...lastMessages,
    ]

    // Rough token estimate
    const tokensSaved = (messages.length - truncated.length) * 500

    this.logger.warn(
      {
        originalCount: messages.length,
        truncatedCount: truncated.length,
        tokensSaved,
      },
      'Reactive compact: emergency truncation applied',
    )

    return {
      truncated: true,
      messages: truncated,
      tokensSaved,
      messagesRemoved: messages.length - truncated.length,
    }
  }

  /**
   * Record a compaction result for circuit breaker tracking.
   */
  recordCompactionResult(success: boolean, contextTokenCount?: number): void {
    void contextTokenCount
    this.circuitBreaker.recordResult(success)
  }

  /**
   * Get degradation warning if context is approaching limits.
   */
  getDegradationWarning(): string | null {
    return this.circuitBreaker.getDegradationWarning()
  }

  /**
   * Check if an error is a prompt-too-long error from any supported provider.
   */
  static isPromptTooLongError(error: unknown): boolean {
    return isPromptTooLongError(error)
  }
}
