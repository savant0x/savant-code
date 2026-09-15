import { ECHO_CRITICAL_SENTINEL } from '../echo/protocol-summary'

import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'

/**
 * Static message helpers used across compaction phases (extracted from
 * ContextCompactor; pure move — no behavior change).
 */
export class CompactionMessage_ {
  // Helper to check if a message has a specific tag
  static hasTag(msg: Message, tag: string): boolean {
    return msg.tags?.includes(tag) ?? false
  }

  // Helper to check if a message is a tool result
  static isToolResult(msg: Message): msg is ToolMessage {
    return msg.role === 'tool'
  }

  // Helper to extract text content from a message
  static getTextContent(msg: Message): string {
    if (typeof msg.content === 'string') {
      return msg.content
    }
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter(
          (part): part is Extract<typeof part, { type: 'text' }> =>
            part.type === 'text',
        )
        .map((part) => part.text)
        .join('\n')
    }
    return ''
  }

  /**
   * FID-2026-0806-003 Phase 1 (P1b): a compaction summary message carries the
   * <structured_state> preserved-state block — the ONLY copy of FID state,
   * todos, loaded skills, and file ops across the compaction boundary.
   * Emergency truncation must never drop it, or the continuation loses the
   * state the pruner worked to preserve.
   */ static hasPreservedState(msg: Message): boolean {
    const text = CompactionMessage_.getTextContent(msg)
    return (
      text.includes('<conversation_summary>') ||
      text.includes('<structured_state>') ||
      // FID-2026-0914-002: the summary envelope carried by the current
      // pruner assembly is <compaction-summary> nested INSIDE
      // <historical_memory> (summary-assembly.ts / fold-exchange.ts).
      // Recognize the bare literal too, so a partial envelope can never
      // slip past the emergency-truncation preserve-set.
      text.includes('<compaction-summary>')
    )
  }

  /**
   * FID-2026-0806-005 Layer 3: messages carrying the critical-context
   * sentinel (the protocol refresh) must survive emergency truncation.
   */
  static hasCriticalContext(msg: Message): boolean {
    return CompactionMessage_.getTextContent(msg).includes(
      ECHO_CRITICAL_SENTINEL,
    )
  }
}

/**
 * Check if an error is a prompt-too-long error from any supported provider.
 */
export function isPromptTooLongError(error: unknown): boolean {
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
