import { memo } from 'react'

import type { FidQueueEntry } from '../../state/transcript-store'
import type { WorkspaceScope } from '../../state/workspace-scope'
import type { JSX } from 'react'

const STATUS_ORDER = [
  'created',
  'analyzed',
  'fixed',
  'verified',
  'converged',
  'closed',
] as const

function statusRank(status: FidQueueEntry['status']): number {
  const rank = STATUS_ORDER.indexOf(status)
  return rank < 0 ? 0 : rank
}

export function fidQueuePresentation(scope: WorkspaceScope): {
  title: string
  label: string
} {
  return scope.type === 'project'
    ? {
        title: 'Project FIDs',
        label: `${scope.label} · authoritative queue`,
      }
    : {
        title: 'Fleet FIDs',
        label: 'All project queues · authoritative events',
      }
}

export function filterFidQueue(
  queue: FidQueueEntry[],
  scope: WorkspaceScope,
): FidQueueEntry[] {
  return scope.type === 'project'
    ? queue.filter((entry) => entry.projectId === scope.id)
    : queue
}

export const FidQueuePanel = memo(function FidQueuePanel({
  queue,
  scope,
}: {
  queue: FidQueueEntry[]
  scope: WorkspaceScope
}): JSX.Element {
  const visibleQueue = filterFidQueue(queue, scope)
  const ordered = [...visibleQueue].sort((left, right) => {
    const rankDelta = statusRank(left.status) - statusRank(right.status)
    return rankDelta === 0 ? left.fidId.localeCompare(right.fidId) : rankDelta
  })
  const openCount = ordered.filter((entry) => entry.status !== 'closed').length
  const presentation = fidQueuePresentation(scope)

  return (
    <aside
      className="fid-queue"
      aria-label={`${presentation.title} for ${presentation.label}`}
    >
      <div className="fid-queue-head">
        <span className="fid-queue-title">{presentation.title}</span>
        <span className="fid-queue-count">{openCount} open</span>
      </div>
      <p className="fid-queue-scope">{presentation.label}</p>
      {ordered.length === 0 ? (
        <p className="fid-queue-empty">Waiting for queue events.</p>
      ) : (
        <div className="fid-queue-list">
          {ordered.map((entry) => (
            <div className="fid-queue-row" key={entry.fidId}>
              <code>{entry.fidId}</code>
              <span className={`fid-status fid-status-${entry.status}`}>
                {entry.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
})
