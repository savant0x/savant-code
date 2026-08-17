/**
 * ToastContainer (FID-2026-0720-033d Phase D Step 3)
 *
 * Renders the toast notification queue from the `useToastStore` Zustand store.
 * Mount once at the app root (app.tsx); toasts appear stacked at the bottom
 * right of the screen and auto-dismiss after their duration (handled in the
 * store).
 *
 * FID-2026-0816-007 step 4: the stack is absolutely positioned over the
 * surface (bottom-right), toasts animate in/out with a translateY slide on the
 * Phase 2 timeline engine, and each toast is z-index layered (newest on top).
 *
 * Law 11 (follow discovered patterns): uses the established Zustand store
 * pattern (matches useChatStore, useLoginStore).
 *
 * Law 14 (error paths): if the queue is empty the container renders nothing;
 * variant → color falls back to 'info' for unknown variants.
 */

import React, { useCallback, useEffect, useRef } from 'react'

import { useAnimationTimeline } from '../hooks/use-animation-timeline'
import { useTheme } from '../hooks/use-theme'
import { useToastStore } from '../hooks/use-toast'

import type { Toast, ToastVariant } from '../hooks/use-toast'
import type { BoxRenderable } from '@opentui/core'

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

const TOAST_STACK_Z_INDEX = 2000
const SLIDE_DURATION = 160
const SLIDE_OFFSET_Y = 3

/** Single toast item — entry/exit slide via the Phase 2 timeline engine. */
const ToastItem = ({
  toast,
  zIndex,
  onDismiss,
}: {
  toast: Toast
  zIndex: number
  onDismiss: (id: string) => void
}) => {
  const theme = useTheme()
  const colorKey = TOAST_COLOR_KEY[toast.variant] ?? 'info'
  const fg = theme[colorKey]
  const timeline = useAnimationTimeline()
  const ref = useRef<BoxRenderable | null>(null)

  const animate = useCallback(
    (enter: boolean) => {
      timeline.items.length = 0
      timeline.add(
        { t: enter ? 0 : 1 },
        {
          t: enter ? 1 : 0,
          duration: SLIDE_DURATION,
          ease: enter ? 'outQuad' : 'inQuad',
          onUpdate: (anim) => {
            const t = anim.targets[0]?.t ?? (enter ? 1 : 0)
            const node = ref.current
            if (node) {
              node.translateY = Math.round(SLIDE_OFFSET_Y * (1 - t))
            }
          },
        },
      )
      timeline.restart()
    },
    [timeline],
  )

  useEffect(() => {
    animate(true)
    return () => {
      timeline.pause()
    }
  }, [animate, timeline])

  useEffect(() => {
    if (toast.closing) {
      animate(false)
    }
  }, [toast.closing, animate])

  return (
    <box
      ref={ref}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        backgroundColor: theme.surface,
        borderStyle: 'rounded',
        borderColor: fg,
        paddingLeft: 1,
        paddingRight: 1,
        zIndex,
      }}
    >
      <text fg={fg}>{toast.message}</text>
      <box style={{ flexGrow: 1 }} />
      <text fg={theme.muted} onMouseDown={() => onDismiss(toast.id)}>
        {'×'}
      </text>
    </box>
  )
}

/**
 * ToastContainer — mount at the app root. Reads the toast queue from the
 * Zustand store and renders toasts absolutely positioned at the bottom-right
 * of the screen.
 */
export const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <box
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        zIndex: TOAST_STACK_Z_INDEX,
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 0,
        paddingRight: 1,
        paddingBottom: 0,
      }}
      focusable={false}
    >
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          zIndex={index}
          onDismiss={dismissToast}
        />
      ))}
    </box>
  )
}

// Re-export the hook for convenience (Law 13 — one import path for consumers)
export { useToast } from '../hooks/use-toast'
