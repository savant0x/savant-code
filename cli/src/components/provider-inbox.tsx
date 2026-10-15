import { useKeyboard } from '@opentui/react'
import { useEffect, useState } from 'react'

import { Button } from './button'
import { DialogOverlay } from './dialog-overlay'
import { useTheme } from '../hooks/use-theme'
import { useProviderInboxStore } from '../state/provider-inbox-store'
import { providerNotifications } from '../utils/provider-notifications'

import type { ProviderNotice } from '@savant-code/common/providers/provider-notifications'

function InboxContent({
  onClose,
  height,
  coordinator,
}: {
  onClose: () => void
  height: number
  coordinator: typeof providerNotifications
}) {
  const theme = useTheme()
  const [notices, setNotices] = useState<ProviderNotice[]>([])
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const refresh = () => {
    try {
      const next = coordinator
        .snapshot()
        .notices.filter((n) => !n.dismissed)
        .reverse()
      setNotices(next)
      setIndex((v) => Math.max(0, Math.min(v, next.length - 1)))
      setError('')
    } catch {
      setError(
        'Notification store unavailable. Original data retained; retry after recovery.',
      )
    }
  }
  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 1000)
    return () => clearInterval(timer)
  }, [])
  const act = (id: string, action: 'read' | 'dismiss') => {
    try {
      coordinator.acknowledge(id, 'cli', action)
      refresh()
    } catch {
      setError('Could not save this action. Please retry.')
    }
  }
  useKeyboard((key) => {
    key.preventDefault?.()
    key.stopPropagation?.()
    if (key.name === 'escape' || (key.ctrl && key.name === 'c')) onClose()
    else if (key.name === 'up') setIndex((v) => Math.max(0, v - 1))
    else if (key.name === 'down')
      setIndex((v) => Math.max(0, Math.min(notices.length - 1, v + 1)))
    else if (notices[index] && (key.name === 'return' || key.name === 'enter'))
      act(notices[index].id, 'read')
    else if (notices[index] && key.name === 'd')
      act(notices[index].id, 'dismiss')
  })
  const visible = notices.slice(
    Math.max(0, index - 2),
    Math.max(0, index - 2) + Math.max(1, Math.floor((height - 8) / 4)),
  )
  return (
    <box
      style={{
        width: '90%',
        maxWidth: 90,
        height: Math.max(6, height - 4),
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: theme.border,
        backgroundColor: theme.surface,
        padding: 1,
      }}
    >
      <text fg={theme.foreground}>
        Provider notifications · {notices.filter((n) => n.unread).length} unread
      </text>
      <text fg={theme.muted}>
        ↑/↓ browse · Enter mark read · D dismiss · Esc close
      </text>
      {error ? <text fg={theme.error}>{error}</text> : null}
      {!notices.length && !error ? (
        <text fg={theme.muted}>No provider notifications.</text>
      ) : null}
      {visible.map((n) => (
        <box
          key={n.id}
          style={{
            flexDirection: 'column',
            backgroundColor:
              notices[index]?.id === n.id ? theme.surfaceHover : theme.surface,
          }}
        >
          <text fg={n.severity === 'info' ? theme.foreground : theme.warning}>
            {n.unread ? '● ' : '○ '}
            {n.message}
          </text>
          <Button onClick={() => act(n.id, n.unread ? 'read' : 'dismiss')}>
            <text fg={theme.primary}>{n.unread ? 'Mark read' : 'Dismiss'}</text>
          </Button>
        </box>
      ))}
    </box>
  )
}
export function ProviderInbox({
  height,
  coordinator = providerNotifications,
}: {
  height: number
  coordinator?: typeof providerNotifications
}) {
  const open = useProviderInboxStore((s) => s.open)
  if (!open) return null
  return (
    <DialogOverlay
      onClose={() => useProviderInboxStore.getState().setOpen(false)}
    >
      {(close) => (
        <InboxContent
          onClose={close}
          height={height}
          coordinator={coordinator}
        />
      )}
    </DialogOverlay>
  )
}
