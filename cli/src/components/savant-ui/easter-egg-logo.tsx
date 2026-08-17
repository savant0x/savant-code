/**
 * Savant Logo Easter Egg (FID-2026-0816-008).
 *
 * The click-state machine lives in an app-root `EasterEggProvider`; the
 * sidebar wordmark (`EasterEggLogo`) is only the trigger, and the escalating
 * overlays (`EasterEggOverlays`) render as a sibling of `AppShell` at the app
 * root.
 *
 * Interaction (operator-corrected 2026-08-16): **one click per message.**
 * Click 1 → "Ouch!" bubble → auto-dismisses back to normal; click 2 → next
 * bubble → auto-dismisses; click 3 → last bubble → auto-dismisses; click 4 →
 * glitch jitter → full-screen fake-terminal takeover (cyan on near-black,
 * a fast ~5 s flood of scrolling "DELETED" lines) → moral bubble →
 * auto-reset to baseline. Bubbles are centered on the chat window (terminal
 * width minus the right sidebar — operator feedback 2026-08-16). Every phase
 * auto-advances on its own timer/timeline; nothing traps the user and no
 * click is ever required to dismiss a popup.
 *
 * Timeline discipline: every `useAnimationTimeline()` call passes an explicit
 * `duration` matching its item — the hook's default (1000 ms) would cut off a
 * longer item and leave the overlay stuck (the FID-2026-0816-005 regression
 * class).
 *
 * Purely visual — no filesystem access, no shell, no store.
 */

import { TextAttributes } from '@opentui/core'
import { useAppContext } from '@opentui/react'
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { Branding } from './branding'
import { useAnimationTimeline } from '../../hooks/use-animation-timeline'
import {
  MORAL_MESSAGE,
  NAG_MESSAGES,
  useEasterEgg,
} from '../../hooks/use-easter-egg'
import {
  useTerminalBreakpoints,
  WIDTH_BREAKPOINTS,
} from '../../hooks/use-terminal-breakpoints'
import { useTheme } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { Clickable } from '../clickable'

import type { EasterEggPhase } from '../../hooks/use-easter-egg'
import type { BoxRenderable } from '@opentui/core'

/** Fake terminal "deletion" output — purely visual string literals. */
const FAKE_DELETED_LINES = [
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

/** Takeover duration (ms) — a fast, readable flood, not a 1 s blip. */
const TAKEOVER_DURATION_MS = 5000
/** Minimum flood window height (rows) — safety floor below real terminals. */
const TAKEOVER_MIN_ROWS = 12
/** Total lines revealed over the duration (12 unique × 40 passes = 480). */
const TAKEOVER_TOTAL_LINES = FAKE_DELETED_LINES.length * 40
/** Nag bubble auto-dismiss (ms) — popups never linger or block. */
const NAG_DURATION_MS = 1500
/**
 * Frozen moral bubble auto-reset (ms) — long enough to fully read the
 * message (operator tweak 2026-08-16: was 3 s, disappeared as the reader
 * finished the sentence).
 */
const FROZEN_DURATION_MS = 5000

/** Full sidebar width (chat/styles.ts) vs the collapsed rail (sidebar-rail). */
const SIDEBAR_EXPANDED_WIDTH = 40
const SIDEBAR_RAIL_WIDTH = 14

/**
 * Current right-sidebar width in the live layout, mirroring `ChatSidebar`'s
 * decision (rail when narrow or manually collapsed, else the full surface).
 * Used to center overlays within the CHAT column — terminal width minus the
 * sidebar — instead of the full viewport (operator feedback 2026-08-16).
 *
 * SSR-safe: reads the renderer through `useAppContext` (defaults to `null`)
 * rather than `useRenderer` (throws outside an OpenTUI app), so the overlays
 * render in tests via `renderToStaticMarkup`.
 */
function useSidebarWidth(): number {
  const { renderer } = useAppContext()
  const isNarrow = (renderer?.width ?? 80) < WIDTH_BREAKPOINTS.narrow
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed)
  return isNarrow || sidebarCollapsed
    ? SIDEBAR_RAIL_WIDTH
    : SIDEBAR_EXPANDED_WIDTH
}

/**
 * Centered overlay layer — fills the viewport (minus the right sidebar) and
 * centers its child. Used by the nag/frozen bubbles so they appear centered
 * on the CHAT window, not the full terminal width (operator directive
 * 2026-08-16: no top-right anchoring, chat-column centering).
 */
const BUBBLE_CENTER = {
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
const BUBBLE_CHROME = {
  border: true,
  borderStyle: 'rounded' as const,
  paddingLeft: 2,
  paddingRight: 2,
  paddingTop: 1,
  paddingBottom: 1,
}

interface EasterEggContextValue {
  phase: EasterEggPhase
  handleClick: () => void
  dismissNag: () => void
  advance: () => void
  reset: () => void
}

const EasterEggContext = createContext<EasterEggContextValue | null>(null)

/**
 * App-root provider. Mount in `app.tsx` around the whole surface so both the
 * sidebar trigger and the root overlay layer share one state machine.
 */
export function EasterEggProvider({ children }: { children: React.ReactNode }) {
  const { phase, handleClick, dismissNag, advance, reset } = useEasterEgg()
  return (
    <EasterEggContext.Provider
      value={{ phase, handleClick, dismissNag, advance, reset }}
    >
      {children}
    </EasterEggContext.Provider>
  )
}

function useEasterEggContext(): EasterEggContextValue {
  const value = useContext(EasterEggContext)
  if (value === null) {
    throw new Error('EasterEggProvider missing — mount it at the app root')
  }
  return value
}

/**
 * NagBubble — small bubble over the logo that auto-dismisses after
 * `NAG_DURATION_MS` and calls `onDone` (advancing the sequence). Never a
 * full-screen dialog, never click-required.
 */
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

/**
 * GlitchOverlay — ~600 ms of jitter + color flash on the wordmark, then
 * auto-advances to the takeover. Timeline-engine driven (no setInterval).
 */
function GlitchOverlay({ onComplete }: { onComplete: () => void }) {
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
} /**
 * TakeoverOverlay — full-screen fake terminal in the Savant colorway:
 * cyan-on-near-black (operator directive 2026-08-16: no navy, no green).
 * A viewport-height window of "DELETED" lines floods the screen and keeps
 * scrolling upward for the full ~5 s (480 lines revealed), so the flood is
 * fast, readable, and fills the terminal top to bottom, then auto-advances
 * to the frozen moral bubble. Timeline duration is pinned to the item
 * duration (see module docs).
 */
function TakeoverOverlay({ onComplete }: { onComplete: () => void }) {
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

/**
 * FrozenBubble — the moral message as a logo-anchored bubble; auto-resets the
 * prank back to baseline after `FROZEN_DURATION_MS` (allowlisted UI timer).
 */
function FrozenBubble({
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

/**
 * EasterEggOverlays — full-screen overlay layer. Mount as a sibling of
 * `AppShell` at the app root (like `ToastContainer`). Each phase auto-advances
 * via its own timer/timeline: a nag bubble dismisses back to `idle` (so the
 * user clicks for the next message), while the glitch/takeover chain plays
 * on its own after the 4th click. The UI always returns to baseline. Renders
 * nothing while idle.
 */
export function EasterEggOverlays() {
  const { phase, dismissNag, advance, reset } = useEasterEggContext()

  if (phase === 'nag-1' || phase === 'nag-2' || phase === 'nag-3') {
    return <NagBubble message={NAG_MESSAGES[phase]} onDone={dismissNag} />
  }

  if (phase === 'glitch') {
    return <GlitchOverlay onComplete={advance} />
  }

  if (phase === 'takeover') {
    return <TakeoverOverlay onComplete={advance} />
  }

  if (phase === 'frozen') {
    return <FrozenBubble message={MORAL_MESSAGE} onReset={reset} />
  }

  return null
}

/**
 * EasterEggLogo — the Savant wordmark + click trigger. A click from `idle`
 * shows the next message (nag-1 → nag-2 → nag-3) or starts the prank on the
 * 4th click (glitch → takeover → frozen). Clicks during a running phase are
 * ignored.
 */
export function EasterEggLogo() {
  const { phase, handleClick } = useEasterEggContext()
  return (
    <Clickable onMouseDown={phase === 'idle' ? handleClick : undefined}>
      <Branding font="tiny" text="Savant" color="primary" />
    </Clickable>
  )
}
