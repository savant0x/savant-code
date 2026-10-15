import { useState } from 'react'

import { useProviderNoticeStore } from '../../state/provider-notifications'

import type { GatewayProviderNotifications } from '../../lib/gateway-provider-notifications'

export function ProviderNotificationsPanel({
  api,
  connected,
}: {
  api: GatewayProviderNotifications
  connected: boolean
}) {
  const notices = useProviderNoticeStore((s) => s.notices)
  const error = useProviderNoticeStore((s) => s.error)
  const loading = useProviderNoticeStore((s) => s.loading)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const visible = notices.filter((n) => !n.dismissed)
  const unread = visible.filter((n) => n.unread).length
  const rows = expanded
    ? visible
    : visible
        .filter((n) => n.selected && n.severity !== 'info' && !n.resolved)
        .slice(0, 3)
  const act = async (id: string, action: 'read' | 'dismiss') => {
    setBusy(true)
    try {
      await api.acknowledge(id, action)
      useProviderNoticeStore.getState().hydrate(await api.snapshot())
      useProviderNoticeStore.getState().setError('')
    } catch {
      useProviderNoticeStore
        .getState()
        .setError('Could not save notification action. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <aside className="fid-queue" aria-label="Provider notifications">
      <button
        type="button"
        className="fid-queue-head"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="fid-queue-title">Provider notifications</span>
        <span className="fid-queue-count">{unread} unread</span>
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {!api.enabled ? (
        <p className="fid-queue-empty">
          Notifications unavailable on this sidecar.
        </p>
      ) : loading ? (
        <p className="fid-queue-empty">Loading provider notifications…</p>
      ) : !visible.length ? (
        <p className="fid-queue-empty">No provider notifications.</p>
      ) : null}
      <div
        className="fid-queue-list"
        style={{
          maxHeight: '24rem',
          overflowY: 'auto',
          overflowWrap: 'anywhere',
        }}
      >
        {rows.map((n) => (
          <article key={n.id} aria-label={`${n.providerId} ${n.kind}`}>
            <p>
              {n.unread ? '● ' : ''}
              {n.message}
            </p>
            <button
              type="button"
              disabled={!connected || busy}
              onClick={() => {
                void act(n.id, 'read')
              }}
            >
              Mark read
            </button>
            <button
              type="button"
              disabled={!connected || busy}
              onClick={() => {
                void act(n.id, 'dismiss')
              }}
            >
              Dismiss
            </button>
          </article>
        ))}
      </div>
    </aside>
  )
}
