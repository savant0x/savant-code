/**
 * Evidence splice (FID-2026-0824-026): restore raw tool results from the
 * evidence spill into a child's inherited history, replacing compaction
 * sentinels. Pure + deterministic; no runtime imports.
 */
import type { EvidenceSpillRecord } from './spill'

type ToolLikeMessage = {
  role: unknown
  toolName?: unknown
  toolCallId?: unknown
  content?: unknown
}

function isCompactedSentinel(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.some((part) => {
    if (typeof part !== 'object' || part === null) return false
    const p = part as Record<string, unknown>
    if (p.value === '[compacted]') return true
    if (
      typeof p.value === 'object' &&
      p.value !== null &&
      (p.value as Record<string, unknown>).compacted === true
    ) {
      return true
    }
    return false
  })
}

export function spliceRawEvidence<T extends ToolLikeMessage>(
  messages: readonly T[],
  records: ReadonlyMap<string, EvidenceSpillRecord>,
): { messages: T[]; restoredToolCallIds: string[] } {
  const restoredToolCallIds: string[] = []
  const out = messages.map((message) => {
    if (
      message.role !== 'tool' ||
      typeof message.toolCallId !== 'string' ||
      !records.has(message.toolCallId) ||
      !isCompactedSentinel(message.content)
    ) {
      return message
    }
    const record = records.get(message.toolCallId)
    if (!record) return message
    let parsed: unknown = record.raw
    try {
      parsed = JSON.parse(record.raw)
    } catch {
      // Non-JSON raw stays wrapped below.
    }
    restoredToolCallIds.push(message.toolCallId)
    return {
      ...message,
      content: [
        {
          type: 'json',
          value:
            typeof parsed === 'string'
              ? { restored: true, raw: parsed }
              : parsed,
        },
      ],
    }
  })
  return { messages: out, restoredToolCallIds }
}

/** Short machine-readable note naming the restored records (bounded). */
export function buildRestoredEvidenceNote(
  ids: readonly string[],
): string | null {
  if (ids.length === 0) return null
  return `<evidence-restored count="${ids.length}">${ids.join(',')}</evidence-restored>`
}
