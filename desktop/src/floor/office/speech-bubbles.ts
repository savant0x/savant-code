/**
 * FID-2026-0831-001 P2 — speech bubble state reducer (pure, zero three.js).
 *
 * Assistant/agent text deltas surface as bounded speech bubbles above the
 * speaking character. Honesty rules (Loop 2): bubbles render only for
 * agentIds present in `FloorState.walkers`; unattributable text is dropped —
 * never guessed onto a character (same honesty rule as `castAgent`).
 *
 * Markdown is flattened and clamped like Hermes3D's speech handling
 * (resources/Hermes3D-main `flattenSpeechBubbleMarkdown`): ≤180 chars,
 * FIFO cap MAX_BUBBLES. Derives from the transcript state already flowing
 * through the driver's gateway subscription — one source of truth.
 */

export const MAX_BUBBLES = 12
/** P20 (operator: "only a small 2 line snippet"): the redesigned caption
 * panel is a wide card — the text budget grows from 180 to 320 chars (~8
 * wrapped lines) so the bubble carries a meaningful passage, not a stub. */
export const MAX_BUBBLE_CHARS = 320
/** A bubble stays visible this long after its last delta, then fades out. */
export const BUBBLE_TTL_MS = 12_000

export interface SpeechBubble {
  readonly agentId: string
  readonly roleId: string
  readonly displayName: string
  readonly text: string
  /** Injected-clock arrival of the last delta (MQ-M: never wall time). */
  readonly lastMs: number
}

/** Flatten markdown to plain text so bubbles never render raw syntax.
 * P21 (operator: "the text is not formatted … raw `| Purpose | -- |` table"):
 * GFM table rows collapse into prose (separator rows dropped, cells joined
 * by spacing) instead of leaking pipes/dashes into the bubble.
 */
export function flattenBubbleText(raw: string): string {
  return (
    raw
      .replace(/```[\s\S]*?```/g, ' [code] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^>\s*/gm, '')
      // GFM table: drop the `|---|---|` separator row entirely.
      .replace(/^\|?[\s:|-]+\|?\s*$/gm, ' ')
      // GFM table (data/header) rows: `| a | b |` → `a  b` prose.
      .replace(/^\|(.+)\|\s*$/gm, (_match, cells: string) =>
        cells
          .split('|')
          .map((cell) => cell.trim())
          .filter((cell) => cell.length > 0)
          .join('  '),
      )
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** Clamp flattened text to MAX_BUBBLE_CHARS with an ellipsis marker. */
export function clampBubbleText(raw: string): {
  text: string
  truncated: boolean
} {
  if (raw.length <= MAX_BUBBLE_CHARS) return { text: raw, truncated: false }
  const slice = raw.slice(0, MAX_BUBBLE_CHARS - 1).trimEnd()
  return { text: `${slice}…`, truncated: true }
}

export interface BubbleUpdateInput {
  readonly agentId: string
  readonly roleId: string
  readonly displayName: string
  /** Raw (markdown) text delta from the transcript/gateway stream. */
  readonly raw: string
  readonly nowMs: number
}

/** Empty or unknown agentIds are unattributable — always dropped. */
function isAttributable(
  agentId: string,
  knownAgentIds: ReadonlySet<string>,
): boolean {
  return agentId.length > 0 && knownAgentIds.has(agentId)
}

/** Fold one text delta into the bubble state. Drops unattributable ids. */
export function applyBubbleDelta(
  bubbles: readonly SpeechBubble[],
  input: BubbleUpdateInput,
  knownAgentIds: ReadonlySet<string>,
): readonly SpeechBubble[] {
  if (!isAttributable(input.agentId, knownAgentIds)) return bubbles
  const flat = clampBubbleText(flattenBubbleText(input.raw))
  if (flat.text.length === 0) return bubbles
  const existing = bubbles.find((bubble) => bubble.agentId === input.agentId)
  const merged =
    existing !== undefined
      ? clampBubbleText(`${existing.text} ${flat.text}`.trim())
      : flat
  const next: SpeechBubble = {
    agentId: input.agentId,
    roleId: input.roleId,
    displayName: input.displayName,
    text: merged.text,
    lastMs: input.nowMs,
  }
  const others = bubbles.filter(
    (bubble) =>
      bubble.agentId !== input.agentId &&
      input.nowMs - bubble.lastMs < BUBBLE_TTL_MS,
  )
  const updated = [...others, next]
  while (updated.length > MAX_BUBBLES) updated.shift()
  return updated
}

/** Drop expired bubbles (past BUBBLE_TTL_MS since last delta). */
export function pruneBubbles(
  bubbles: readonly SpeechBubble[],
  nowMs: number,
): readonly SpeechBubble[] {
  const kept = bubbles.filter((bubble) => nowMs - bubble.lastMs < BUBBLE_TTL_MS)
  return kept.length === bubbles.length ? bubbles : kept
}
