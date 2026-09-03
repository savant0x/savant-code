// FID-2026-0901-006 P11 + P18 — the office cast must never show two figures
// for the same role. A spawned Thinker ("Savant the Thinker") and the standby
// idle filler (roleId 'thinker') both targeting pad / role 'thinker' resulted
// in a duplicate Thinker on the floor. `officeWalkerCast` dedupes: a real
// walker claims its role, and a standby filler is only added for roles that
// don't already have a real walker.
//
// P18 (operator: "we're getting double spawns… 'savant the x' agents spawn
// during real work"): savant-role walkers (orchestrator personas) fold into
// the single centerpiece — never a second Savant figure — and dissolved
// walkers release their role/pad so the roster stays complete.

import { describe, expect, test } from 'bun:test'

import { officeWalkerCast } from '../office-walker-cast'

import type { WalkerState } from '../../adapter/floor-adapter'

function walker(
  agentId: string,
  roleId: string,
  displayName: string,
  padIndex: number,
): WalkerState {
  return {
    agentId,
    roleId: roleId as WalkerState['roleId'],
    displayName,
    padIndex,
    phase: 'active',
    stationTarget: null,
  }
}

describe('officeWalkerCast role dedup (FID-2026-0901-006 P11)', () => {
  test('a spawned Thinker replaces the standby idle Thinker (no duplicate)', () => {
    const walkers = new Map<string, WalkerState>()
    // Real spawned thinker — "Savant the Thinker" persona, pad 4.
    walkers.set(
      'thinker-1',
      walker('thinker-1', 'thinker', 'Savant the Thinker', 4),
    )

    const cast = officeWalkerCast(walkers)

    const thinkers = cast.filter((entry) => entry.roleId === 'thinker')
    expect(thinkers).toHaveLength(1)
    // P18: the nameplate shows the canonical role label, never the persona.
    expect(thinkers[0].agentId).toBe('thinker-1')
    expect(thinkers[0].displayName).toBe('Thinker')
  })

  test('no idle filler is emitted for a role with a real walker', () => {
    const walkers = new Map<string, WalkerState>()
    walkers.set('forge-1', walker('forge-1', 'forge', 'Forge', 3))

    const cast = officeWalkerCast(walkers)

    // Forge real walker present → no `idle-*` filler also claims roleId forge.
    const forgers = cast.filter((entry) => entry.roleId === 'forge')
    expect(forgers).toHaveLength(1)
    expect(forgers[0].agentId).toBe('forge-1')
  })

  test('unspawned roles still get one figure each, never a duplicate role', () => {
    const cast = officeWalkerCast(new Map())

    // The invariant is role uniqueness, not a fixed headcount (Savant claims
    // pad 0, so the first specialist filler is guarded off that pad and the
    // cast is a subset of the canonical roster). No role may appear twice.
    const roleIds = cast.map((entry) => entry.roleId)
    expect(new Set(roleIds).size).toBe(roleIds.length)
    // Savant is always the centerpiece.
    expect(cast.some((entry) => entry.roleId === 'savant')).toBe(true)
  })

  test('a dissolved walker releases its role to the standby filler (P18)', () => {
    const walkers = new Map<string, WalkerState>()
    walkers.set('scout-1', {
      ...walker('scout-1', 'scout', 'Scout', 5),
      phase: 'dissolved',
    })
    const cast = officeWalkerCast(walkers)
    const scouts = cast.filter((entry) => entry.roleId === 'scout')
    // The dissolved figure is gone; the standby filler holds the role and
    // the roster stays complete.
    expect(scouts).toHaveLength(1)
    expect(scouts[0].phase).toBe('active')
    expect(scouts[0].agentId.startsWith('idle-')).toBe(true)
  })

  test('a savant-role persona walker folds into the one centerpiece (P18)', () => {
    const walkers = new Map<string, WalkerState>()
    // The orchestrator persona spawn — casted roleId 'savant' via
    // castByDisplayName("Savant the DeepSeek Free Orchestrator").
    walkers.set(
      'orchestrator-1',
      walker(
        'orchestrator-1',
        'savant',
        'Savant the DeepSeek Free Orchestrator',
        2,
      ),
    )

    const cast = officeWalkerCast(walkers)
    const savants = cast.filter((entry) => entry.roleId === 'savant')
    expect(savants).toHaveLength(1)
    // The centerpiece carries the orchestrator's live station target.
    expect(savants[0].agentId).toBe('orchestrator-1')
    expect(
      cast.filter((entry) => entry.agentId === 'orchestrator-1'),
    ).toHaveLength(1)
  })

  test('display names are always the canonical role labels (P18 naming)', () => {
    const walkers = new Map<string, WalkerState>()
    walkers.set(
      'thinker-1',
      walker('thinker-1', 'thinker', 'Savant the Thinker', 4),
    )
    const cast = officeWalkerCast(walkers)
    for (const entry of cast) {
      // No persona flavor text on the floor — every plate is the role name.
      expect(entry.displayName).not.toContain('Savant the')
    }
  })

  test('savant centerpiece mirrors the orchestrator station target', () => {
    const walkers = new Map<string, WalkerState>()
    walkers.set('orch-1', {
      ...walker('orch-1', 'savant', 'Savant', 0),
      stationTarget: 'command-spire',
    })
    const cast = officeWalkerCast(walkers)
    const savant = cast.find((entry) => entry.roleId === 'savant')
    expect(savant?.stationTarget).toBe('command-spire')
  })
})
