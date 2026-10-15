import { describe, expect, test } from 'bun:test'

import {
  autoAdvanceTransition,
  clickTransition,
  MORAL_MESSAGE,
  NAG_MESSAGES,
  nagDismissTransition,
  NEXT_AUTO,
  resetTransition,
} from '../use-easter-egg'

import type { EasterEggState } from '../use-easter-egg'

const IDLE: EasterEggState = { phase: 'idle', level: 0 }

describe('useEasterEgg state machine (FID-2026-0816-008)', () => {
  test('click-per-message: three clicks each show a nag, then auto-dismiss to idle', () => {
    // Click 1 → nag-1
    let state = clickTransition(IDLE)
    expect(state.phase).toBe('nag-1')
    // Bubble auto-dismisses back to normal (no chaining!)
    state = nagDismissTransition(state)
    expect(state).toEqual({ phase: 'idle', level: 1 })
    // Click 2 → nag-2
    state = clickTransition(state)
    expect(state.phase).toBe('nag-2')
    state = nagDismissTransition(state)
    expect(state).toEqual({ phase: 'idle', level: 2 })
    // Click 3 → nag-3
    state = clickTransition(state)
    expect(state.phase).toBe('nag-3')
    state = nagDismissTransition(state)
    expect(state).toEqual({ phase: 'idle', level: 3 })
  })

  test('the 4th click starts the prank (glitch → takeover → frozen → reset)', () => {
    let state: EasterEggState = { phase: 'idle', level: 3 }
    state = clickTransition(state)
    expect(state.phase).toBe('glitch')
    state = autoAdvanceTransition(state)
    expect(state.phase).toBe('takeover')
    state = autoAdvanceTransition(state)
    expect(state.phase).toBe('frozen')
    state = resetTransition()
    expect(state).toEqual({ phase: 'idle', level: 0 })
  })

  test('clicks during a running phase are ignored', () => {
    for (const phase of ['nag-1', 'glitch', 'takeover', 'frozen'] as const) {
      const state: EasterEggState = { phase, level: 1 }
      expect(clickTransition(state)).toBe(state)
    }
  })

  test('dismiss/advance transitions only apply to their own phases', () => {
    // nagDismiss only acts on nag phases
    expect(nagDismissTransition({ phase: 'glitch', level: 2 })).toEqual({
      phase: 'glitch',
      level: 2,
    })
    expect(nagDismissTransition(IDLE)).toEqual(IDLE)
    // autoAdvance only acts on glitch/takeover
    expect(autoAdvanceTransition({ phase: 'nag-1', level: 0 })).toEqual({
      phase: 'nag-1',
      level: 0,
    })
    expect(autoAdvanceTransition({ phase: 'frozen', level: 0 })).toEqual({
      phase: 'frozen',
      level: 0,
    })
  })

  test('the auto chain covers glitch and takeover with no undefined transitions', () => {
    expect(NEXT_AUTO.glitch).toBe('takeover')
    expect(NEXT_AUTO.takeover).toBe('frozen')
    // Every phase either has an auto successor or is terminal/idle-driven.
    for (const phase of Object.keys(NEXT_AUTO)) {
      expect(NEXT_AUTO[phase as keyof typeof NEXT_AUTO]).toBeDefined()
    }
  })

  test('three nag messages + moral message exist for the overlays', () => {
    expect(Object.keys(NAG_MESSAGES)).toHaveLength(3)
    expect(NAG_MESSAGES['nag-1']).toBe('Ouch!')
    expect(NAG_MESSAGES['nag-3']).toContain('stop poking')
    expect(MORAL_MESSAGE).toContain('Be nice')
  })
})
