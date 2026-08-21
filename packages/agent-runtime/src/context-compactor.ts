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
import { runMicroCompact } from './context-compactor/micro-compact'
import { isPromptTooLongError } from './context-compactor/phases'
import { runReactiveCompact } from './context-compactor/reactive-compact'
import { AUTO_COMPACT_BUFFER } from './context-compactor/state'

import type {
  AutoCompactCheck,
  CompactorOptions,
  MicroCompactResult,
  ReactiveCompactResult,
  Thresholds,
} from './context-compactor/state'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

export {
  AUTO_COMPACT_BUFFER,
  CIRCUIT_BREAKER_COOLDOWN_MS,
  CIRCUIT_BREAKER_MAX_FAILURES,
} from './context-compactor/state'

export { CompactionMessage_ } from './context-compactor/phases'

export { buildCompactedToolValue } from './context-compactor/micro-compact'

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
    return runMicroCompact({
      messages,
      contextTokenCount,
      enabled: this.microCompactEnabled,
      maxKeepRecent: this.thresholds.microCompactMaxKeepRecent,
      floorTokens: this.microCompactFloorTokens,
      logger: this.logger,
    })
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
    return runReactiveCompact({ messages, logger: this.logger })
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
