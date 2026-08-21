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

import React, { createContext, useContext } from 'react'

import { Branding } from './branding'
import {
  FrozenBubble,
  GlitchOverlay,
  NagBubble,
  TakeoverOverlay,
} from './easter-egg-overlay-components'
import {
  MORAL_MESSAGE,
  NAG_MESSAGES,
  useEasterEgg,
} from '../../hooks/use-easter-egg'
import { Clickable } from '../clickable'

import type { EasterEggPhase } from '../../hooks/use-easter-egg'

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

export { NagBubble } from './easter-egg-overlay-components'

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
