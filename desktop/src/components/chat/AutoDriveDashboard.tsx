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
  roots: string[]
  edges: Array<{ parentId: string; childId: string }>
}

export function summarizeAutoDrive(queue: FidQueueEntry[]): AutoDriveSummary {
  const byStatus = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, 0]),
  ) as Record<Status, number>
  for (const entry of queue) byStatus[entry.status] += 1
  const ids = new Set(queue.map((entry) => entry.fidId))
  const edges = queue
    .filter(
      (entry): entry is FidQueueEntry & { parentId: string } =>
        entry.parentId !== undefined && ids.has(entry.parentId),
    )
    .map((entry) => ({ parentId: entry.parentId, childId: entry.fidId }))
    .sort((left, right) =>
      `${left.parentId}/${left.childId}`.localeCompare(
        `${right.parentId}/${right.childId}`,
      ),
    )
  return {
    total: queue.length,
    open: queue.filter((entry) => entry.status !== 'closed').length,
    byStatus,
    roots: queue
      .filter(
        (entry) => entry.parentId === undefined || !ids.has(entry.parentId),
      )
      .map((entry) => entry.fidId)
      .sort(),
    edges,
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
    <aside className="auto-drive" aria-label="Auto Drive dashboard">
      <div className="auto-drive-head">
        <span className="auto-drive-title">Auto Drive</span>
        <span className="auto-drive-count">
          {summary.open}/{summary.total} open
        </span>
      </div>
      <div className="auto-drive-state" role="status">
        {running ? 'Run active' : 'Idle'}
      </div>
      <div className="auto-drive-statuses" aria-label="FID status summary">
        {STATUS_ORDER.map((status) => (
          <div className="auto-drive-status" key={status}>
            <span>{status}</span>
            <strong>{summary.byStatus[status]}</strong>
          </div>
        ))}
      </div>
      <div className="auto-drive-graph" aria-label="FID dependency graph">
        <span className="auto-drive-graph-title">Dependency graph</span>
        {summary.edges.length === 0 ? (
          <span className="auto-drive-graph-note">No declared edges.</span>
        ) : (
          summary.edges.map((edge) => (
            <span
              className="auto-drive-edge"
              key={`${edge.parentId}/${edge.childId}`}
            >
              {edge.parentId} → {edge.childId}
            </span>
          ))
        )}
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
