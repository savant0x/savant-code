/**
 * FID-2026-1007-004 steps 3 and 5 — the omission-marker readers.
 *
 * A destructive path leaves one of two shapes behind: the older `[compacted]`
 * sentinel (the compaction layers) or the `omitted` marker
 * (`util/simplify-tool-results.ts`, the trim pass). Two consumers need to read
 * those shapes — the spawn splice, which puts stored bytes back, and the spawn
 * gate, which decides whether a non-audit agent needs the store at all — so the
 * reading lives here once rather than twice (Law 13).
 *
 * Pure and dependency-free on purpose: `splice.ts` is a pure module and the
 * spawn gate must be checkable without a store. The reads are duck-typed, so
 * this module adds no import edge to the transform that writes the marker.
 */

/** `{ compacted: true }` inside a part's value — the older sentinel spelling. */
export function isCompactedMarker(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return (value as Record<string, unknown>).compacted === true
}

/** `[compacted]`-shaped message content — the compaction layers' sentinel. */
export function isCompactedSentinel(messageContent: unknown): boolean {
  if (!Array.isArray(messageContent)) return false
  return messageContent.some((part) => {
    if (typeof part !== 'object' || part === null) return false
    const value = (part as Record<string, unknown>).value
    return value === '[compacted]' || isCompactedMarker(value)
  })
}

/**
 * The `omitted.retained` proof on a value, when there is one. Recognises the
 * marker at the top of a value and on any element of an array of entries
 * (`read_files` carries one marker per file).
 */
export function omitsRetainedBytes(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(omitsRetainedBytes)
  if (!value || typeof value !== 'object') return false
  const omitted = (value as Record<string, unknown>).omitted
  if (!omitted || typeof omitted !== 'object' || Array.isArray(omitted)) {
    return false
  }
  const retained = (omitted as Record<string, unknown>).retained
  return (
    !!retained &&
    typeof retained === 'object' &&
    !Array.isArray(retained) &&
    (retained as Record<string, unknown>).ok === true
  )
}

/**
 * A message whose payload was replaced and which names where the original went —
 * either sentinel. This is the gate both consumers share: sentinel-shaped
 * content is the only thing worth restoring over.
 */
export function isRestorableLoss(messageContent: unknown): boolean {
  return isCompactedSentinel(messageContent) || isOmissionMarked(messageContent)
}

function isOmissionMarked(messageContent: unknown): boolean {
  if (!Array.isArray(messageContent)) return false
  return messageContent.some((part) => {
    if (typeof part !== 'object' || part === null) return false
    return omitsRetainedBytes((part as Record<string, unknown>).value)
  })
}

/**
 * The tool call ids a history says it is missing bytes for. Used to scope a
 * NON-audit spawn to the records it actually owns (FID-2026-1007-004 step 5):
 * the gate is need, not role.
 */
export function retainedToolCallIds(messages: readonly unknown[]): string[] {
  const ids: string[] = []
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue
    const candidate = message as Record<string, unknown>
    if (candidate.role !== 'tool') continue
    const toolCallId = candidate.toolCallId
    if (typeof toolCallId !== 'string' || toolCallId.length === 0) continue
    if (isRestorableLoss(candidate.content)) ids.push(toolCallId)
  }
  return ids
}
