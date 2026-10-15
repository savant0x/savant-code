// P21 (operator: "threads needs to be changed to something useful", and the
// Threads rail was empty/dead in their env): the left rail now surfaces the
// live session state the operator actually wants at a glance — active model,
// context window usage, what the run is doing, and the Perfection Loop phase.
// Same single sources the topbar + chat-reader use (Law 13); presentation only.

import { memo } from 'react'

import { activityLabel } from './activity-label'
import { formatTokens } from './CompactionStatusBar'
import { formatModelLabel } from '../../lib/model-label'

import type {
  CompactionStatus,
  CurrentActivity,
} from '../../state/transcript-store'
import type { JSX } from 'react'

// P26: the per-kind label switch moved to ./activity-label (Law 13).

export const SessionStatusPanel = memo(function SessionStatusPanel({
  model,
  phase,
  running,
  activity,
  compaction,
}: {
  model: string | null
  phase: string | null
  running: boolean
  activity: CurrentActivity | null
  compaction: CompactionStatus | null
}): JSX.Element {
  const percent =
    compaction?.percentUsed !== undefined
      ? Math.round(compaction.percentUsed)
      : null
  const tracker =
    compaction?.contextTokens !== undefined && compaction.windowTokens
      ? `${formatTokens(compaction.contextTokens)}/${formatTokens(compaction.windowTokens)}`
      : null

  return (
    <aside className="session-status" aria-label="Live session status">
      <div className="session-status-head">
        <span className="session-status-title">Session</span>
        <span
          className={`session-status-live${running ? ' live' : ''}`}
          aria-hidden="true"
        />
      </div>

      {/* Active model — hidden until one is captured (no blank junk rows). */}
      {model !== null ? (
        <div className="session-status-row">
          <span className="session-status-key">Model</span>
          <span className="session-status-value">
            {formatModelLabel(model)}
          </span>
        </div>
      ) : null}

      {/* Run state + current activity */}
      <div className="session-status-row">
        <span className="session-status-key">State</span>
        <span
          className={`session-status-value ${running ? 'session-active' : ''}`}
        >
          {running
            ? activity !== null
              ? activityLabel(activity)
              : 'Working…'
            : 'Idle'}
        </span>
      </div>

      {/* Context window usage — hidden until the runtime reports it. */}
      {percent !== null ? (
        <div className="session-status-row">
          <span className="session-status-key">Context</span>
          <span className="session-status-value">
            {`${percent}%${tracker !== null ? ` · ${tracker}` : ''}`}
          </span>
        </div>
      ) : null}

      {percent !== null ? (
        <div className="session-meter" aria-hidden="true">
          <span
            className="session-meter-fill"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      ) : null}

      {/* Perfection Loop phase */}
      {phase !== null ? (
        <div className="session-status-row">
          <span className="session-status-key">Phase</span>
          <span className="session-status-value session-phase">{phase}</span>
        </div>
      ) : null}

      {/* No session data yet — a single honest line instead of blank rows. */}
      {model === null && percent === null && phase === null ? (
        <p className="session-status-empty">
          Start a run to populate session telemetry.
        </p>
      ) : null}
    </aside>
  )
})
