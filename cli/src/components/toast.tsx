/**
 * ToastContainer (FID-2026-0720-033d Phase D Step 3)
 *
 * Renders the toast notification queue from the `useToastStore` Zustand store.
 * Mount once at the app root (app.tsx); toasts appear stacked at the bottom
 * of the screen and auto-dismiss after their duration (handled in the store).
 *
 * Law 11 (follow discovered patterns): uses the established Zustand store
 * pattern (matches useChatStore, useLoginStore). The container is a pure
 * render of store state — no local state.
 *
 * Law 14 (error paths): the container is a pure layout box; if the toast
 * queue is empty it renders nothing. Individual toast rendering never throws
 * (variant → color map has a 'muted' fallback for unknown variants).
 */

import React from 'react'

import { useTheme } from '../hooks/use-theme'
import { useToastStore } from '../hooks/use-toast'

import type { ToastVariant } from '../hooks/use-toast'

/** Toast variant → ChatTheme color key. Single truth (Law 13). */
const TOAST_COLOR_KEY: Record<
  ToastVariant,
  'error' | 'warning' | 'success' | 'info'
> = {
  error: 'error',
  warning: 'warning',
  success: 'success',
  info: 'info',
}

/** Single toast item — rendered by ToastContainer. */
const ToastItem = ({
  id,
  message,
  variant,
  onDismiss,
}: {
  id: string
  message: string
  variant: ToastVariant
  onDismiss: (id: string) => void
}) => {
  const theme = useTheme()
  const colorKey = TOAST_COLOR_KEY[variant] ?? 'info'
  const fg = theme[colorKey]

  return (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        backgroundColor: theme.surface,
        borderStyle: 'rounded',
        borderColor: fg,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={fg}>{message}</text>
      <box style={{ flexGrow: 1 }} />
      <text fg={theme.muted} onMouseDown={() => onDismiss(id)}>
        {'×'}
      </text>
    </box>
  )
}

/**
 * ToastContainer — mount at the app root. Reads the toast queue from the
 * Zustand store and renders toasts stacked at the bottom of the screen.
 */
export const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 0,
        marginTop: 'auto',
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: 0,
      }}
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          variant={toast.variant}
          onDismiss={dismissToast}
        />
      ))}
    </box>
  )
}

// Re-export the hook for convenience (Law 13 — one import path for consumers)
export { useToast } from '../hooks/use-toast'
