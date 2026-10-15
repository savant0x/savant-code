/**
 * Evidence splice (FID-2026-0824-026): restore raw tool results from the
 * evidence spill into a child's inherited history, replacing compaction
 * sentinels. Pure + deterministic; no runtime imports.
 *
 * FID-2026-1007-004 step 5 widened the shape it recognises. `[compacted]` is
 * only what the COMPACTION layers write; the four transforms and the trim pass
 * replace a payload with a bounded kept value plus an `omitted` marker, and the
 * splice skipped every one of those — so a stored original could not be put back
 * over the marker that had taken its place. The shapes now live in
 * `./omission.ts` and are read from one place.
 */
import { isRestorableLoss } from './omission'

import type { EvidenceSpillRecord } from './spill'

type ToolLikeMessage = {
  role: unknown
  toolName?: unknown
  toolCallId?: unknown
  content?: unknown
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
      !isRestorableLoss(message.content)
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
