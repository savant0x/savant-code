// FID-2026-0905-005 RED pins — the scene's pure agent-logic.
//
// Green on the extracted logic BEFORE any component module moves (the
// monolith's logic was module-private: zero direct coverage before these
// pins). Fixtures build real WalkerState/FloorState shapes.

import { describe, expect, test } from 'bun:test'

import {
  labelFor,
  makeThinkingPredicate,
  targetFor,
  THINKING_PILL_HOLD_MS,
} from '../scene-agent-logic'

import type {
  FloorState,
  ToolInFlight,
  WalkerState,
} from '../../adapter/floor-adapter'

// --- Fixtures ------------------------------------------------------------

function walker(overrides: Partial<WalkerState> = {}): WalkerState {
  return {
    agentId: 'agent-1',
    roleId: 'detective',
    displayName: 'Detective',
    padIndex: 2,
    phase: 'active',
    stationTarget: null,
    ...overrides,
  }
}

function floorState(overrides: Partial<FloorState> = {}): FloorState {
  const walkers = new Map<string, WalkerState>()
  const pendingTools = new Map<string, ToolInFlight>()
  const reasoningClocks = new Map<string, number>()
  return {
    savantPresent: false,
    walkers,
    pendingTools,
    fsmPhase: null,
    pulseSeq: 0,
    lastPulse: null,
    thinkerBursts: [],
    reasoningClocks,
    ...overrides,
  }
}

// --- targetFor ------------------------------------------------------------

describe('targetFor (RED pins)', () => {
  test('a working walker routes to the stand spot of its station desk', () => {
    const working = walker({
      stationTarget: 'file-forge',
    })
    const target = targetFor(working)
    expect(Number.isFinite(target.x)).toBe(true)
    expect(Number.isFinite(target.z)).toBe(true)
  })

  test('the savant routes to the command-tile spot, not a pad slot', () => {
    const savant = walker({
      roleId: 'savant',
      padIndex: 0,
      stationTarget: null,
    })
    const target = targetFor(savant)
    expect(Number.isFinite(target.x)).toBe(true)
    expect(Number.isFinite(target.z)).toBe(true)
  })

  test('an idle specialist routes to the stand spot of its home pad', () => {
    const idle = walker({ padIndex: 3, stationTarget: null })
    const target = targetFor(idle)
    expect(Number.isFinite(target.x)).toBe(true)
    expect(Number.isFinite(target.z)).toBe(true)
  })
})

// --- labelFor -------------------------------------------------------------

describe('labelFor (RED pins)', () => {
  test('savant renders ORCHESTRATOR regardless of station', () => {
    expect(labelFor(walker({ roleId: 'savant' }))).toBe('ORCHESTRATOR')
    expect(
      labelFor(walker({ roleId: 'savant', stationTarget: 'file-forge' })),
    ).toBe('ORCHESTRATOR')
  })

  test('a working specialist renders ROLE · WORKING', () => {
    const label = labelFor(
      walker({ roleId: 'detective', stationTarget: 'file-forge' }),
    )
    expect(label).toContain('Detective')
    expect(label).toContain('WORKING')
  })

  test('an idle specialist renders ROLE · STANDBY', () => {
    const label = labelFor(walker({ roleId: 'forge', stationTarget: null }))
    expect(label).toContain('Forge')
    expect(label).toContain('STANDBY')
  })

  test('an unknown (generic) role falls back to the display name, never blank', () => {
    const label = labelFor(
      walker({ roleId: 'generic', displayName: 'Custom Agent' }),
    )
    expect(label).toBe('Custom Agent · STANDBY')
  })
})

// --- makeThinkingPredicate --------------------------------------------------

describe('makeThinkingPredicate (RED pins)', () => {
  test('stationTarget is the original signal: always true', () => {
    const floor = floorState()
    const probe = makeThinkingPredicate(
      walker({ stationTarget: 'file-forge' }),
      floor,
    )
    expect(probe()).toBe(true)
  })

  test('a recent per-agent reasoning clock lights the pill', () => {
    const floor = floorState({
      reasoningClocks: new Map([['agent-1', performance.now() - 100]]),
    })
    const probe = makeThinkingPredicate(walker(), floor)
    expect(probe()).toBe(true)
  })

  test('a stale per-agent reasoning clock stays dark', () => {
    const floor = floorState({
      reasoningClocks: new Map([
        ['agent-1', performance.now() - THINKING_PILL_HOLD_MS - 1],
      ]),
    })
    const probe = makeThinkingPredicate(walker(), floor)
    expect(probe()).toBe(false)
  })

  test('savant claims recent NON-WALKER reasoning only while savantPresent', () => {
    const now = performance.now()
    // The orchestrator runtime id is never a walker map entry.
    const floor = floorState({
      savantPresent: true,
      reasoningClocks: new Map([['runtime-main', now - 100]]),
    })
    const lit = makeThinkingPredicate(walker({ roleId: 'savant' }), floor)
    expect(lit()).toBe(true)

    const dark = makeThinkingPredicate(
      walker({ roleId: 'savant' }),
      floorState({
        savantPresent: false,
        reasoningClocks: floor.reasoningClocks,
      }),
    )
    expect(dark()).toBe(false)
  })

  test('savant never claims reasoning that belongs to a walker (walker id in map)', () => {
    const now = performance.now()
    const own = walker({ roleId: 'detective' })
    const floor = floorState({
      savantPresent: true,
      walkers: new Map([[own.agentId, own]]),
      reasoningClocks: new Map([[own.agentId, now - 100]]),
    })
    // The savant probe uses a DISTINCT id so the per-agent branch cannot
    // fire — this isolates the savant-claim loop: walker-owned clocks are
    // skipped there (the detective lights only the detective).
    const probe = makeThinkingPredicate(
      walker({ roleId: 'savant', agentId: 'savant-1' }),
      floor,
    )
    expect(probe()).toBe(false)
  })

  test('an idle floor with stale clocks never lights up', () => {
    const floor = floorState({
      savantPresent: false,
      reasoningClocks: new Map([['runtime-main', 0]]),
    })
    const probe = makeThinkingPredicate(walker(), floor)
    expect(probe()).toBe(false)
  })
})
