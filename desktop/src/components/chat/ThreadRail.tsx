import { memo } from 'react'

import type { WorkspaceThread } from '../../state/transcript-store'
import type { JSX } from 'react'

export function orderWorkspaceThreads(
  threads: WorkspaceThread[],
): WorkspaceThread[] {
  return [...threads].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
    if (left.unread !== right.unread) return left.unread ? -1 : 1
    return left.chatId.localeCompare(right.chatId)
  })
}

export const ThreadRail = memo(function ThreadRail({
  threads,
  onUpdate,
}: {
  threads: WorkspaceThread[]
  onUpdate(
    sessionId: string,
    state: { unread?: boolean; pinned?: boolean },
  ): void
}): JSX.Element {
  const ordered = orderWorkspaceThreads(threads)

  return (
    <aside className="thread-rail" aria-label="Workspace threads">
      <div className="thread-rail-head">
        <span className="thread-rail-title">Threads</span>
        <span className="thread-rail-count">{ordered.length}</span>
      </div>
      {ordered.length === 0 ? (
        <p className="thread-rail-empty">No persisted threads.</p>
      ) : (
        <div className="thread-rail-list">
          {ordered.map((thread) => (
            <div
              className={`thread-rail-row${thread.unread ? ' thread-rail-row-unread' : ''}`}
              key={thread.sessionId}
            >
              <span
                className="thread-rail-unread"
                aria-label={thread.unread ? 'Unread' : 'Read'}
                title={thread.unread ? 'Unread' : 'Read'}
              />
              <span className="thread-rail-label">{thread.chatId}</span>
              <button
                className={`thread-rail-action${thread.pinned ? ' thread-rail-action-active' : ''}`}
                type="button"
                aria-label={`${thread.pinned ? 'Unpin' : 'Pin'} ${thread.chatId}`}
                title={thread.pinned ? 'Unpin thread' : 'Pin thread'}
                onClick={() =>
                  onUpdate(thread.sessionId, { pinned: !thread.pinned })
                }
              >
                {thread.pinned ? '●' : '○'}
              </button>
              <button
                className="thread-rail-action"
                type="button"
                aria-label={`${thread.unread ? 'Mark read' : 'Mark unread'} ${thread.chatId}`}
                title={thread.unread ? 'Mark read' : 'Mark unread'}
                onClick={() =>
                  onUpdate(thread.sessionId, { unread: !thread.unread })
                }
              >
                {thread.unread ? '✓' : '·'}
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
})
