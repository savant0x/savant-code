// FID-2026-0901-006 P2 — CLI-parity running status bar. The CLI shows a live
// "what is the agent doing right now" line (loading phrase + elapsed timer)
// driven by the runtime's `activity` stream. The desktop previously dropped
// `activity` events entirely, so a running turn looked frozen. This consumes
// the same stream through the transcript store: activity label + elapsed
// timer, cleared on `finish`.

import { memo, useEffect, useState } from 'react'

import { activityLabel } from './activity-label'

import type { CurrentActivity } from '../../state/transcript-store'
import type { JSX } from 'react'

// P26: the per-kind label switch moved to ./activity-label (Law 13) — the
// deck mini-chat renders the same wording, so one function owns it.

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0
    ? `${minutes}m ${String(rest).padStart(2, '0')}s`
    : `${rest}s`
}

export const RunStatusBar = memo(function RunStatusBar({
  activity,
  running,
}: {
  activity: CurrentActivity | null
  running: boolean
}): JSX.Element | null {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const startedAt = activity?.startedAt

  useEffect(() => {
    if (!running || startedAt === undefined) {
      setElapsedSeconds(0)
      return
    }
    const update = (): void => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [running, startedAt])

  if (!running) return null

  // Before the first activity event (or between them) show a generic label —
  // the run is definitely alive; we just don't know its current verb.
  const label = activityLabel(activity)

  return (
    <div className="run-status" role="status" aria-live="polite">
      <span className="run-status-pulse" aria-hidden="true" />
      <span className="run-status-label">{label}</span>
      {elapsedSeconds > 0 ? (
        <span className="run-status-elapsed">
          {formatElapsed(elapsedSeconds)}
        </span>
      ) : null}
    </div>
  )
})
