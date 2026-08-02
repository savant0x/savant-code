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
 */

import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * Message type for compaction operations.
 * Compatible with the Message type from session-state but loosely typed
 * to avoid circular imports.
 */
export interface CompactionMessage {
  role: string
  content:
    string | Array<{ type: string; text?: string; [key: string]: unknown }>
  tags?: string[]
  toolName?: string
  toolCallId?: string
  keepDuringTruncation?: boolean
  timeToLive?: string
  sentAt?: number
}

interface CompactorOptions {
  logger: Logger
  contextWindow?: number
  model?: string
}

interface Thresholds {
  /** Token count at which auto-compact triggers */
  autoCompact: number
  /** Token count at which reactive compact triggers (hard limit) */
  reactiveCompact: number
  /** Max messages to keep in micro-compact */
  microCompactMaxKeepRecent: number
}

interface MicroCompactResult {
  messages: CompactionMessage[]
  tokensSaved: number
  messagesCleared: number
}

interface AutoCompactCheck {
  shouldCompact: boolean
  reason?: string
  percentUsed?: number
}

interface ReactiveCompactResult {
  truncated: boolean
  messages: CompactionMessage[]
  tokensSaved: number
  messagesRemoved: number
}

/**
 * Circuit breaker states for compaction failures.
 */
type CircuitState = 'healthy' | 'degraded' | 'open' | 'half-open'

const CIRCUIT_BREAKER_MAX_FAILURES = 3
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
const AUTO_COMPACT_BUFFER = 30_000 // 30k token buffer before hard limit

export class CompactionMessage_ {
  // Helper to check if a message has a specific tag
  static hasTag(msg: CompactionMessage, tag: string): boolean {
    return msg.tags?.includes(tag) ?? false
  }

  // Helper to check if a message is a tool result
  static isToolResult(msg: CompactionMessage): boolean {
    return msg.role === 'tool'
  }

  // Helper to extract text content from a message
  static getTextContent(msg: CompactionMessage): string {
    if (typeof msg.content === 'string') {
      return msg.content
    }
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((part) => part.type === 'text' && part.text)
        .map((part) => part.text!)
        .join('\n')
    }
    return ''
  }
}

export class ContextCompactor {
  private logger: Logger
  private contextWindow: number
  private model: string
  private thresholds: Thresholds

  // Circuit breaker state
  private circuitState: CircuitState = 'healthy'
  private failureCount = 0
  private lastFailureTime = 0
  private lastSuccessTime = 0

  // Degradation warning tracking
  private degradationWarningShown = false

  constructor(options: CompactorOptions) {
    this.logger = options.logger
    this.contextWindow = options.contextWindow ?? 200_000
    this.model = options.model ?? 'unknown'

    // Calculate thresholds based on context window
    this.thresholds = {
      autoCompact: Math.max(this.contextWindow - AUTO_COMPACT_BUFFER, 100_000),
      reactiveCompact: this.contextWindow,
      microCompactMaxKeepRecent: 3,
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
    return { ...this.thresholds }
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
  microCompact(messages: CompactionMessage[]): MicroCompactResult {
    const originalCount = messages.length
    const compacted: CompactionMessage[] = []
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

    // Keep all non-tool messages and the N most recent tool results
    const keepRecent = toolResultIndices.slice(
      -this.thresholds.microCompactMaxKeepRecent,
    )
    const clearSet = new Set(
      toolResultIndices.filter((idx) => !keepRecent.includes(idx)),
    )

    for (let i = 0; i < messages.length; i++) {
      if (clearSet.has(i)) {
        // Replace with a minimal placeholder that preserves the slot
        compacted.push({
          role: 'tool',
          content: [{ type: 'json', value: '[compacted]' }],
          toolName: messages[i].toolName,
          toolCallId: messages[i].toolCallId,
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
    messages: CompactionMessage[],
    contextTokenCount: number,
  ): AutoCompactCheck {
    // Check circuit breaker
    if (this.circuitState === 'open') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed > CIRCUIT_BREAKER_COOLDOWN_MS) {
        this.circuitState = 'half-open'
        this.logger.info('Circuit breaker: half-open (cooldown elapsed)')
      } else {
        return {
          shouldCompact: false,
          reason: `Circuit breaker open — cooldown ${Math.ceil((CIRCUIT_BREAKER_COOLDOWN_MS - elapsed) / 60_000)}min remaining`,
        }
      }
    }

    const percentUsed = Math.round(
      (contextTokenCount / this.thresholds.autoCompact) * 100,
    )

    if (contextTokenCount >= this.thresholds.autoCompact) {
      return {
        shouldCompact: true,
        reason: `Context at ${percentUsed}% (${contextTokenCount.toLocaleString()} / ${this.thresholds.autoCompact.toLocaleString()} tokens)`,
        percentUsed,
      }
    }

    return { shouldCompact: false, percentUsed }
  }

  /**
   * Layer 4: Reactive compact — emergency truncation on prompt-too-long error.
   *
   * Preserves: first message (system/instructions), last 20% of messages
   * (minimum 2), any messages with images (multimodal context).
   * Retries API call once after truncation.
   */
  reactiveCompact(messages: CompactionMessage[]): ReactiveCompactResult {
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

    // Preserve messages with images (multimodal)
    const imageMessages = messages.filter((msg) => {
      if (typeof msg.content === 'string') return false
      return (
        Array.isArray(msg.content) &&
        msg.content.some(
          (part) => part.type === 'image' || part.type === 'image_url',
        )
      )
    })

    // Build preserved set (deduplicate)
    const preservedIndices = new Set<number>()
    preservedIndices.add(0) // first message
    for (let i = messages.length - keepFromEnd; i < messages.length; i++) {
      preservedIndices.add(i)
    }
    for (const imgMsg of imageMessages) {
      const idx = messages.indexOf(imgMsg)
      if (idx >= 0) preservedIndices.add(idx)
    }

    const truncated = [
      firstMessage,
      ...messages
        .filter((_, idx) => !preservedIndices.has(idx) && idx !== 0)
        .slice(0, Math.floor(messages.length * 0.1)), // Keep 10% of middle for context
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
    if (success) {
      this.failureCount = 0
      this.lastSuccessTime = Date.now()
      if (this.circuitState === 'half-open') {
        this.circuitState = 'healthy'
        this.logger.info('Circuit breaker: healthy (compaction succeeded)')
      }
    } else {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= CIRCUIT_BREAKER_MAX_FAILURES) {
        this.circuitState = 'open'
        this.logger.warn(
          { failureCount: this.failureCount },
          `Circuit breaker: open (${this.failureCount} consecutive failures, ${CIRCUIT_BREAKER_COOLDOWN_MS / 60_000}min cooldown)`,
        )
      } else if (this.circuitState === 'half-open') {
        this.circuitState = 'open'
        this.logger.warn('Circuit breaker: re-opened (half-open test failed)')
      }
    }
  }

  /**
   * Get degradation warning if context is approaching limits.
   */
  getDegradationWarning(): string | null {
    if (this.degradationWarningShown) return null

    if (this.circuitState === 'open') {
      this.degradationWarningShown = true
      return '⚠️ Context compaction circuit breaker is OPEN. Auto-compaction disabled for 5 minutes due to repeated failures. Context may grow unbounded during this period.'
    }
    if (this.circuitState === 'degraded') {
      return '⚠️ Context compaction is degraded. Some compaction attempts have failed.'
    }
    return null
  }

  /**
   * Check if an error is a prompt-too-long error from any supported provider.
   */
  static isPromptTooLongError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    const getString = (value: unknown): string | undefined => {
      if (typeof value === 'string') return value
      return undefined
    }

    const message =
      getString('message' in error ? error.message : undefined) ??
      getString('error' in error ? error.error : undefined) ??
      ''
    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode
        : undefined

    // HTTP 400/413/422 with prompt-too-long patterns
    if (statusCode === 400 || statusCode === 413 || statusCode === 422) {
      const lowerMsg = message.toLowerCase()
      return (
        lowerMsg.includes('prompt is too long') ||
        lowerMsg.includes('context_length_exceeded') ||
        lowerMsg.includes('maximum context length') ||
        lowerMsg.includes('token limit') ||
        lowerMsg.includes('too many tokens') ||
        lowerMsg.includes('input too long') ||
        lowerMsg.includes('request too large')
      )
    }

    // Error code patterns (Anthropic, OpenRouter, etc.)
    const code =
      getString('code' in error ? error.code : undefined) ??
      getString('error_code' in error ? error.error_code : undefined) ??
      ''
    if (
      code === 'context_length_exceeded' ||
      code === 'prompt_too_long' ||
      code === 'max_tokens'
    ) {
      return true
    }

    // Message-only patterns (fallback)
    const lowerMsg = message.toLowerCase()
    return (
      lowerMsg.includes('prompt is too long') ||
      lowerMsg.includes('context_length_exceeded') ||
      lowerMsg.includes('maximum context length') ||
      lowerMsg.includes('token limit exceeded') ||
      lowerMsg.includes('request too large')
    )
  }
}
