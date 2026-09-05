import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'

// FID-2026-0819-005 Loop 298: pure transcript formatting helpers, moved
// verbatim from transcript-store.ts.

export function safeJson(value: unknown): string {
  try {
    const serialized = JSON.stringify(value, null, 2)
    return serialized === undefined ? String(value) : serialized
  } catch {
    // Circular or otherwise unserializable payload — degrade, never throw.
    return String(value)
  }
}

export function summarizeApproval(content: unknown): string {
  const flat = safeJson(content).replace(/\s+/g, ' ').trim()
  return flat.length > 240 ? `${flat.slice(0, 240)}…` : flat
}

/** Pull `{phase}` out of a transition_phase result's json parts (G2 rule). */
export function extractFsmPhase(output: ToolResultOutput[]): string | null {
  for (const part of output) {
    if (part.type !== 'json') continue
    const value: unknown = part.value
    if (typeof value === 'object' && value !== null && 'phase' in value) {
      const phase = (value as { phase?: unknown }).phase
      if (typeof phase === 'string' && phase.length > 0) return phase
    }
  }
  return null
}

export function formatToolOutput(output: ToolResultOutput[]): string {
  return output
    .map((part) =>
      part.type === 'json' ? safeJson(part.value) : `[media ${part.mediaType}]`,
    )
    .join('\n')
}
