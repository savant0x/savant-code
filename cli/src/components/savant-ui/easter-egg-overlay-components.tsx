import { TextAttributes } from '@opentui/core'
import { useAppContext } from '@opentui/react'
import React, { useEffect, useRef, useState } from 'react'

import { Branding } from './branding'
import { useAnimationTimeline } from '../../hooks/use-animation-timeline'
import {
  useTerminalBreakpoints,
  WIDTH_BREAKPOINTS,
} from '../../hooks/use-terminal-breakpoints'
import { useTheme } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'

import type { BoxRenderable } from '@opentui/core'

/** Fake terminal "deletion" output — purely visual string literals. */
export const FAKE_DELETED_LINES = [
  'DELETED C:\\Users\\spenc\\dev\\savant-code\\cli\\src\\app.tsx',
  'DELETED cli/src/chat/panels.tsx',
  'DELETED cli/src/components/dialog-overlay.tsx',
  'DELETED cli/src/hooks/use-animation-timeline.ts',
  'DELETED dev/fids/FID-2026-0816-008-savant-logo-easter-egg.md',
  'DELETED sdk/src/index.ts',
  'DELETED C:\\Users\\spenc\\dev\\savant-code\\ARCHITECTURE.md',
  'DELETED README.md',
  'DELETED docs/design/ui-overhaul-plan.md',
  'DELETED CHANGELOG.md',
  'DELETED cli/src/utils/diff-stats.ts',
  'DELETED dev/LEARNINGS.md',
] as const

export const TAKEOVER_DURATION_MS = 5000
export const TAKEOVER_MIN_ROWS = 12
export const TAKEOVER_TOTAL_LINES = FAKE_DELETED_LINES.length * 40
export const NAG_DURATION_MS = 1500
export const FROZEN_DURATION_MS = 5000

export const SIDEBAR_EXPANDED_WIDTH = 40
export const SIDEBAR_RAIL_WIDTH = 14

/**
 * Current right-sidebar width in the live layout (rail when narrow or
 * collapsed, else the full surface) — centers overlays within the CHAT
 * column. SSR-safe via `useAppContext` (defaults to null outside OpenTUI).
 */
export function useSidebarWidth(): number {
  const { renderer } = useAppContext()
  const isNarrow = (renderer?.width ?? 80) < WIDTH_BREAKPOINTS.narrow
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed)
  return isNarrow || sidebarCollapsed
    ? SIDEBAR_RAIL_WIDTH
    : SIDEBAR_EXPANDED_WIDTH
}

/** Centered overlay layer — fills the viewport minus the sidebar, centers its child. */
export const BUBBLE_CENTER = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 900,
  flexDirection: 'column' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
}

/** Bubble chrome — small framed card, never full-screen. */
export const BUBBLE_CHROME = {
  border: true,
  borderStyle: 'rounded' as const,
  paddingLeft: 2,
  paddingRight: 2,
  paddingTop: 1,
  paddingBottom: 1,
}

/** NagBubble — small auto-dismissing bubble over the logo (never full-screen). */
export function NagBubble({
  message,
  onDone,
}: {
  message: string
  onDone: () => void
}) {
  const theme = useTheme()
  const sidebarWidth = useSidebarWidth()

  useEffect(() => {
    const timer = setTimeout(onDone, NAG_DURATION_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [onDone])

  return (
    <box style={{ ...BUBBLE_CENTER, right: sidebarWidth }}>
      <box
        style={{
          ...BUBBLE_CHROME,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        <text
          fg={theme.foreground}
          attributes={TextAttributes.BOLD}
          style={{ wrapMode: 'word' }}
        >
          {message}
        </text>
      </box>
    </box>
  )
}

/** GlitchOverlay — ~600 ms of wordmark jitter + color flash, then advances. */
export function GlitchOverlay({ onComplete }: { onComplete: () => void }) {
  const theme = useTheme()
  const timeline = useAnimationTimeline({ duration: 600 })
  const wordmarkRef = useRef<BoxRenderable | null>(null)
  const [flash, setFlash] = useState(0)

  useEffect(() => {
    timeline.items.length = 0
    timeline.add(
      { t: 0 },
      {
        t: 1,
        duration: 600,
        onUpdate: (anim) => {
          const t = anim.targets[0]?.t ?? 0
          const node = wordmarkRef.current
          if (node) {
            node.translateX = Math.round(Math.sin(t * Math.PI * 2 * 5) * 3)
          }
          setFlash(Math.floor(t * 16) % 2)
        },
        onComplete,
      },
    )
    timeline.restart()
    return () => {
      timeline.pause()
    }
  }, [timeline, onComplete])

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 950,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.background,
      }}
    >
      <box ref={wordmarkRef}>
        <Branding
          font="tiny"
          text="Savant"
          color={flash ? 'foreground' : 'primary'}
        />
      </box>
    </box>
  )
}

/** TakeoverOverlay — full-screen fake-terminal flood of "DELETED" lines. */
export function TakeoverOverlay({ onComplete }: { onComplete: () => void }) {
  const theme = useTheme()
  const { height } = useTerminalBreakpoints()
  // Window sized to the real viewport so the flood covers the whole height.
  const windowRows = Math.max(TAKEOVER_MIN_ROWS, height)
  const timeline = useAnimationTimeline({ duration: TAKEOVER_DURATION_MS })
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    timeline.items.length = 0
    timeline.add(
      { t: 0 },
      {
        t: 1,
        duration: TAKEOVER_DURATION_MS,
        ease: 'linear',
        onUpdate: (anim) => {
          const t = anim.targets[0]?.t ?? 0
          setRevealed(Math.floor(t * TAKEOVER_TOTAL_LINES))
        },
        onComplete,
      },
    )
    timeline.restart()
    return () => {
      timeline.pause()
    }
  }, [timeline, onComplete])

  // The window slides upward as lines are revealed: the screen fills top to
  // bottom instantly, then the lines keep flooding past for the rest of the
  // duration.
  const offset = Math.max(0, revealed - windowRows)
  const visibleLines = Array.from(
    { length: windowRows },
    (_, index) =>
      FAKE_DELETED_LINES[(offset + index) % FAKE_DELETED_LINES.length],
  )

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        flexDirection: 'column',
        gap: 0,
        backgroundColor: theme.background,
        paddingLeft: 1,
        paddingTop: 1,
      }}
    >
      {visibleLines.map((line, index) => (
        <text key={index} fg={theme.primary} style={{ wrapMode: 'none' }}>
          {line}
        </text>
      ))}
    </box>
  )
}

/** FrozenBubble — the moral message; auto-resets the prank to baseline. */
export function FrozenBubble({
  message,
  onReset,
}: {
  message: string
  onReset: () => void
}) {
  const theme = useTheme()
  const sidebarWidth = useSidebarWidth()

  useEffect(() => {
    const timer = setTimeout(onReset, FROZEN_DURATION_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [onReset])

  return (
    <box style={{ ...BUBBLE_CENTER, right: sidebarWidth }}>
      <box
        style={{
          ...BUBBLE_CHROME,
          borderColor: theme.error,
          backgroundColor: theme.surface,
        }}
      >
        <text
          fg={theme.error}
          attributes={TextAttributes.BOLD}
          style={{ wrapMode: 'word' }}
        >
          {message}
        </text>
      </box>
    </box>
  )
}
