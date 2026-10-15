import { memo } from 'react'

import type {
  AutoDriveHaltState,
  FidQueueEntry,
} from '../../state/transcript-store'
import type { JSX } from 'react'

const STATUS_ORDER = [
  'created',
  'analyzed',
  'fixed',
  'verified',
  'converged',
  'closed',
] as const

type Status = (typeof STATUS_ORDER)[number]

export function autoDriveHaltLabel(state: AutoDriveHaltState): string {
  switch (state) {
    case 'requested':
      return 'Halt requested'
    case 'confirmed':
      return 'Halt accepted'
    case 'failed':
      return 'Retry emergency halt'
    case 'idle':
      return 'Emergency halt'
  }
}

export type AutoDriveSummary = {
  total: number
  open: number
  byStatus: Record<Status, number>
}

// P20 (operator: "auto drive is a feature you can activate, simply showing
// 'auto drive x/x open' is useless"): the dashboard is an FID lifecycle
// summary + emergency-halt control — no passive run-state header (the real
// run state lives in the chat status bar), and no dependency-graph section
// (the edges data is unused by any operator workflow).
export function summarizeAutoDrive(queue: FidQueueEntry[]): AutoDriveSummary {
  const byStatus = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, 0]),
  ) as Record<Status, number>
  for (const entry of queue) byStatus[entry.status] += 1
  return {
    total: queue.length,
    open: queue.filter((entry) => entry.status !== 'closed').length,
    byStatus,
  }
}

export const AutoDriveDashboard = memo(function AutoDriveDashboard({
  queue,
  running,
  haltState,
  onHalt,
}: {
  queue: FidQueueEntry[]
  running: boolean
  haltState: AutoDriveHaltState
  onHalt(): void
}): JSX.Element {
  const summary = summarizeAutoDrive(queue)
  const haltDisabled =
    !running || haltState === 'requested' || haltState === 'confirmed'

  return (
    <aside className="auto-drive" aria-label="FID lifecycle dashboard">
      <div className="auto-drive-head">
        <span className="auto-drive-title">FID Status</span>
        <span className="auto-drive-count">
          {summary.open}/{summary.total} open
        </span>
      </div>
      <div className="auto-drive-statuses" aria-label="FID status summary">
        {STATUS_ORDER.map((status) => (
          <div className="auto-drive-status" key={status}>
            <span>{status}</span>
            <strong>{summary.byStatus[status]}</strong>
          </div>
        ))}
      </div>
      <button
        className="auto-drive-halt"
        type="button"
        disabled={haltDisabled}
        onClick={onHalt}
      >
        {autoDriveHaltLabel(haltState)}
      </button>
    </aside>
  )
})
