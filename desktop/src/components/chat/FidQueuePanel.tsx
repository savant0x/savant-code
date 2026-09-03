import { memo, useState } from 'react'

import type { FidQueueEntry } from '../../state/transcript-store'
import type { WorkspaceScope } from '../../state/workspace-scope'
import type { JSX } from 'react'

// P21 (operator: "project fids is entirely too tall … should only show 1-10,
// with a foldable div"): the list is capped to a visible preview (header row
// + first N rows) with a full expand/collapse toggle, and locked to a
// bounded height so the rail never balloons.
export const PREVIEW_ROWS = 6
export const MAX_EXPANDED_ROWS = 10

/** Bound a queue to the fold window — pure so the preview logic is testable. */
export function boundFidRows(
  ordered: FidQueueEntry[],
  expanded: boolean,
): FidQueueEntry[] {
  return ordered.slice(0, expanded ? MAX_EXPANDED_ROWS : PREVIEW_ROWS)
}

// P20 (operator: "project fids still show 'fixed/closed' fids in the
// sidebars"): the rail is an ACTIVE queue — a closed FID is done and belongs
// in the archive, not the sidebar. `fixed` is mid-loop (GREEN done, audit
// pending), so it stays.

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

/** FIDs still moving through the loop — closed entries are dropped. */
export function activeFidQueue(queue: FidQueueEntry[]): FidQueueEntry[] {
  return queue.filter((entry) => entry.status !== 'closed')
}

export const FidQueuePanel = memo(function FidQueuePanel({
  queue,
  scope,
}: {
  queue: FidQueueEntry[]
  scope: WorkspaceScope
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const visibleQueue = activeFidQueue(filterFidQueue(queue, scope))
  const ordered = [...visibleQueue].sort((left, right) => {
    const rankDelta = statusRank(left.status) - statusRank(right.status)
    return rankDelta === 0 ? left.fidId.localeCompare(right.fidId) : rankDelta
  })
  const openCount = ordered.length
  const presentation = fidQueuePresentation(scope)

  // Bounded preview: first PREVIEW_ROWS collapsed, up to MAX_EXPANDED_ROWS
  // when the operator opens the fold. The header row always stays visible.
  const visibleRows = boundFidRows(ordered, expanded)
  const hasMore = openCount > visibleRows.length

  return (
    <aside
      className="fid-queue"
      aria-label={`${presentation.title} for ${presentation.label}`}
    >
      <button
        type="button"
        className="fid-queue-head"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="fid-queue-title">{presentation.title}</span>
        <span className="fid-queue-count">{openCount} open</span>
      </button>
      <p className="fid-queue-scope">{presentation.label}</p>
      {ordered.length === 0 ? (
        <p className="fid-queue-empty">No open FIDs — queue is clear.</p>
      ) : (
        <div className="fid-queue-list">
          {visibleRows.map((entry) => (
            <div className="fid-queue-row" key={entry.fidId}>
              <code>{entry.fidId}</code>
              <span className={`fid-status fid-status-${entry.status}`}>
                {entry.status}
              </span>
            </div>
          ))}
          {hasMore ? (
            <button
              type="button"
              className="fid-queue-more"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded
                ? collapseLabel
                : `show ${Math.min(openCount - PREVIEW_ROWS, MAX_EXPANDED_ROWS - PREVIEW_ROWS)} more`}
            </button>
          ) : null}
        </div>
      )}
    </aside>
  )
})

const collapseLabel = 'show less'
