// FID-2026-0901-006 P11 — pure office walker-cast builder. The office floor
// shows the full 10-role ECHO roster AT ALL TIMES: Savant at the central
// emblem plus the nine specialists on their home pads as standby figures.
// Real spawned subagents (from `floor.walkers`) must REPLACE their role's
// standby filler, not duplicate it — otherwise spawning the Thinker produces
// two Thinker figures (a spawned "Savant the Thinker" AND the standby idle
// filler for the same role).
//
// P18 (operator: "we're getting double spawns… 'savant the x' agents spawn
// during real work, all others are always there"): two more correctness
// rules beyond the original dedupe —
//
//   1. A walker whose CASTED ROLE is `savant` (an orchestrator-persona
//      spawn, e.g. displayName "Savant the DeepSeek Free Orchestrator")
//      never renders as a second Savant figure. The orchestrator IS the
//      centerpiece; its walker folds into the single `savant` entry.
//   2. A DISSOLVED walker releases its role and pad: the standby filler
//      claims the role again and the dissolved figure is dropped. The
//      roster is always present; transient spawn/finish must not shrink
//      or duplicate the cast.
//
// Nameplate naming (operator: "why is 'savant the thinker' spawning instead
// of the base 'thinker'"): the persona displayName is run-internal flavor;
// the floor is a role stage. Every entry renders the canonical ROLE_LABEL,
// never the raw persona string — which also fixes the truncated
// "SAVANT THE THI" plate (overlong persona names overflowed the canvas).
//
// Pure and independently testable: input Walkers (the floor adapter map),
// output a deduped roster array with exactly one figure per roleId. Kept
// out of office-scene.tsx so the invariant is locked by unit tests (the
// scene's useMemo is otherwise untestable without a three.js harness).

import { DECK_ROLE_IDS, ROLE_LABELS } from '../roles'

import type { WalkerState } from '../adapter/floor-adapter'
import type { DeckRoleId, DeckCoreRoleId } from '../roles'

/** One office cast figure — either a real walker or a standby filler. */
export interface OfficeCastEntry {
  readonly agentId: string
  readonly roleId: DeckRoleId
  readonly displayName: string
  readonly padIndex: number
  readonly phase: WalkerState['phase']
  readonly stationTarget: WalkerState['stationTarget']
}

const STANDBY_PAD_COUNT = 9

/**
 * Build the office cast from the floor adapter's walker map.
 *
 * - Savant-role walkers (the orchestrator, persona or fallback) fold into
 *   ONE centerpiece entry — never a second Savant figure.
 * - A real active walker wins its specialist role (keeps pad + station
 *   target); standby fillers only fill roles with no active walker.
 * - Dissolved walkers release their role/pad back to the standby pool.
 * - displayName is always the canonical role label (persona strings never
 *   reach the nameplate).
 */
export function officeWalkerCast(
  walkers: ReadonlyMap<string, WalkerState>,
): OfficeCastEntry[] {
  const roster = new Map<string, OfficeCastEntry>()

  // Savant is the centerpiece — always present, exactly once. Any walker
  // whose casted role is 'savant' (orchestrator personas included) folds
  // into this entry instead of rendering a duplicate figure.
  const savantWalker = [...walkers.values()].find(
    (candidate) => candidate.roleId === 'savant',
  )
  roster.set('savant', {
    agentId: savantWalker?.agentId ?? 'savant',
    roleId: 'savant',
    displayName: ROLE_LABELS.savant,
    padIndex: 0,
    phase: 'active',
    // The orchestrator's station target drives the command-tile visit.
    stationTarget: savantWalker?.stationTarget ?? null,
  })

  // Seed active specialist walkers; first active walker per role wins.
  for (const walker of walkers.values()) {
    if (walker.roleId === 'savant') continue // folded above
    if (walker.phase !== 'active') continue // dissolved releases the role
    if ([...roster.values()].some((entry) => entry.roleId === walker.roleId))
      continue
    roster.set(walker.agentId, {
      agentId: walker.agentId,
      roleId: walker.roleId,
      displayName:
        ROLE_LABELS[walker.roleId as DeckCoreRoleId] ?? walker.roleId,
      padIndex: walker.padIndex,
      phase: walker.phase,
      stationTarget: walker.stationTarget,
    })
  }

  const heldPads = new Set<number>()
  for (const entry of roster.values()) {
    heldPads.add(entry.padIndex)
  }

  for (let index = 0; index < STANDBY_PAD_COUNT; index += 1) {
    if (heldPads.has(index)) continue
    const id = `idle-${index}`
    const role = DECK_ROLE_IDS[index + 1] ?? 'generic'
    if ([...roster.values()].some((entry) => entry.roleId === role)) continue
    roster.set(id, {
      agentId: id,
      roleId: role,
      displayName: ROLE_LABELS[role] ?? role,
      padIndex: index,
      phase: 'active',
      stationTarget: null,
    })
    heldPads.add(index)
  }

  return [...roster.values()]
}
