import { useCallback, useState } from 'react'

/**
 * Easter-egg click-state machine (FID-2026-0816-008).
 *
 * Interaction (operator-corrected 2026-08-16): **one click per message.**
 * Click 1 → "Ouch!" bubble over the logo → auto-dismisses back to normal.
 * Click 2 → next bubble → auto-dismisses. Click 3 → last bubble →
 * auto-dismisses. Click 4 → glitch jitter → full-screen fake-terminal
 * takeover → moral bubble → auto-reset to baseline. Every phase auto-advances
 * on its own timer/timeline; nothing traps the user and no click is ever
 * required to dismiss a popup. Clicks during a running phase are ignored.
 *
 * State is component/provider-local (no store pollution).
 */

export type EasterEggPhase =
  'idle' | 'nag-1' | 'nag-2' | 'nag-3' | 'glitch' | 'takeover' | 'frozen'

export interface EasterEggState {
  phase: EasterEggPhase
  /** How many nag messages have already been shown and dismissed (0..3). */
  level: number
}

/** Phase a click lands on, given how many nags were already dismissed. */
export const CLICK_PHASE_BY_LEVEL: Record<number, EasterEggPhase> = {
  0: 'nag-1',
  1: 'nag-2',
  2: 'nag-3',
  3: 'glitch',
}

/** Auto-play chain once the glitch starts (timeline `onComplete` driven). */
export const NEXT_AUTO: Partial<Record<EasterEggPhase, EasterEggPhase>> = {
  glitch: 'takeover',
  takeover: 'frozen',
}

/** Clicks 1–3 nag bubbles — logo-anchored, auto-dismiss on a timer. */
export const NAG_MESSAGES: Record<'nag-1' | 'nag-2' | 'nag-3', string> = {
  'nag-1': 'Ouch!',
  'nag-2': 'Hey! That hurts, please stop.',
  'nag-3': 'Seriously, stop poking me.',
}

/** Frozen-phase moral message. */
export const MORAL_MESSAGE =
  "See... being poked isn't fun? Be nice, I can be mean too."

/** A click only acts while idle; level 3 (after 3 dismissed nags) triggers the prank. */
export function clickTransition(state: EasterEggState): EasterEggState {
  if (state.phase !== 'idle') return state
  return {
    phase: CLICK_PHASE_BY_LEVEL[state.level] ?? 'nag-1',
    level: state.level,
  }
}

/** Nag bubble auto-dismissed: back to normal, one level closer to the prank. */
export function nagDismissTransition(state: EasterEggState): EasterEggState {
  const isNag =
    state.phase === 'nag-1' ||
    state.phase === 'nag-2' ||
    state.phase === 'nag-3'
  if (!isNag) return state
  return { phase: 'idle', level: Math.min(state.level + 1, 3) }
}

/** Glitch/takeover timeline completed: follow the auto-play chain. */
export function autoAdvanceTransition(state: EasterEggState): EasterEggState {
  const next = NEXT_AUTO[state.phase]
  return next ? { phase: next, level: state.level } : state
}

/** Frozen moral bubble timed out: full reset to baseline. */
export function resetTransition(): EasterEggState {
  return { phase: 'idle', level: 0 }
}

export function useEasterEgg(): EasterEggState & {
  handleClick: () => void
  dismissNag: () => void
  advance: () => void
  reset: () => void
} {
  const [state, setState] = useState<EasterEggState>({
    phase: 'idle',
    level: 0,
  })

  const handleClick = useCallback(() => {
    setState(clickTransition)
  }, [])

  const dismissNag = useCallback(() => {
    setState(nagDismissTransition)
  }, [])

  const advance = useCallback(() => {
    setState(autoAdvanceTransition)
  }, [])

  const reset = useCallback(() => {
    setState(resetTransition)
  }, [])

  return { ...state, handleClick, dismissNag, advance, reset }
}
