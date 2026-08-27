import { memo } from 'react'

import type { CompactionStatus } from '../../state/transcript-store'
import type { JSX } from 'react'

export const CompactionStatusBar = memo(function CompactionStatusBar({
  status,
}: {
  status: CompactionStatus | null
}): JSX.Element | null {
  if (status === null || status.phase === 'idle') return null
  const label =
    status.phase === 'blocked'
      ? `Compaction blocked (${status.blockReason ?? 'unknown'})`
      : status.phase === 'compacted' || status.phase === 'pruned'
        ? `Compaction complete${status.tokensSaved ? ` · −${status.tokensSaved} tokens` : ''}`
        : status.phase === 'warning'
          ? `Context warning${status.percentUsed !== undefined ? ` · ${status.percentUsed}%` : ''}`
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
