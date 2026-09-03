import { memo } from 'react'

import type { CompactionStatus } from '../../state/transcript-store'
import type { JSX } from 'react'

// FID-2026-0901-006 P3: the bar is now a persistent context meter. The
// runtime emits `compaction_status` (with `percentUsed`) every step —
// including `phase: 'idle'` — so the operator always sees "context NN%"
// instead of a control that only appears when something is already wrong.
// Warning/blocked/compacted phases keep their attention-grabbing styling.

const METER_WARN_AT = 70
const METER_DANGER_AT = 85

function meterLevel(percent: number): 'ok' | 'warn' | 'danger' {
  if (percent >= METER_DANGER_AT) return 'danger'
  if (percent >= METER_WARN_AT) return 'warn'
  return 'ok'
}

/** FID-2026-0901-006 P4: "84192" → "84k" for the window tracker chip. */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`
  return String(tokens)
}

export const CompactionStatusBar = memo(function CompactionStatusBar({
  status,
}: {
  status: CompactionStatus | null
}): JSX.Element | null {
  if (status === null) return null

  const percent =
    status.percentUsed !== undefined ? Math.round(status.percentUsed) : null

  if (status.phase === 'idle') {
    // Steady state: a quiet meter chip. No percent (yet) → nothing to show.
    if (percent === null) return null
    const level = meterLevel(percent)
    // FID-2026-0901-006 P4: absolute window tracker — "context 42% · 84k/200k"
    // — when the runtime supplied token counts (it always does now).
    const tracker =
      status.contextTokens !== undefined && status.windowTokens
        ? ` · ${formatTokens(status.contextTokens)}/${formatTokens(status.windowTokens)}`
        : ''
    return (
      <div
        className={`context-meter context-${level}`}
        role="status"
        aria-label={`Context ${percent}% used${tracker ? tracker.replace(' · ', ', ') : ''}`}
        title="Context window usage"
      >
        <span className="context-meter-track" aria-hidden="true">
          <span
            className="context-meter-fill"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </span>
        <span className="context-meter-label">
          context {percent}%{tracker}
        </span>
      </div>
    )
  }

  const label =
    status.phase === 'blocked'
      ? `Compaction blocked (${status.blockReason ?? 'unknown'})`
      : status.phase === 'compacted' || status.phase === 'pruned'
        ? `Compaction complete${status.tokensSaved ? ` · −${status.tokensSaved} tokens` : ''}`
        : status.phase === 'warning'
          ? `Context warning${percent !== null ? ` · ${percent}%` : ''}${
              status.contextTokens !== undefined && status.windowTokens
                ? ` · ${formatTokens(status.contextTokens)}/${formatTokens(status.windowTokens)}`
                : ''
            }`
          : status.phase === 'compacting'
            ? 'Compacting context…'
            : 'Compaction ineffective'
  return (
    <div
      className={`compaction-status compaction-${status.phase}`}
      role="status"
      aria-live="polite"
    >
      <span>{label}</span>
    </div>
  )
})
