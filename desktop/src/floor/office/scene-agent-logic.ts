// FID-2026-0905-005 — office-scene decomposition: pure agent-logic.
//
// RED step 1: the scene's module-private pure logic, extracted VERBATIM so
// the characterization pins (scene-agent-logic.test.ts) import the real
// functions BEFORE any component module moves. No React/three imports —
// pure functions over WalkerState/FloorState + office-plan routing.

import { ROLE_LABELS } from '../roles'
import {
  deskPosition,
  homePosition,
  savantSpot,
  standSpot,
} from './office-plan'

import type { Vec2 } from './office-motion'
import type { FloorState, WalkerState } from '../adapter/floor-adapter'

export function targetFor(walker: WalkerState): Vec2 {
  if (walker.stationTarget !== null)
    return standSpot(deskPosition(walker.stationTarget))
  // P6c: the orchestrator's home is the command tile, not a pad slot.
  return walker.roleId === 'savant'
    ? savantSpot()
    : standSpot(homePosition(walker.padIndex))
}

/** Subtitle for an agent's nameplate: role label + living status verb. */
export function labelFor(walker: WalkerState): string {
  // ROLE_LABELS only covers the 10 core roles; an unknown role renders the
  // walker's display name (never a blank subtitle).
  const core = walker.roleId as keyof typeof ROLE_LABELS
  const role =
    walker.roleId === 'generic'
      ? walker.displayName
      : (ROLE_LABELS[core] ?? walker.displayName)
  if (walker.roleId === 'savant') return 'ORCHESTRATOR'
  if (walker.stationTarget !== null) return `${role} · WORKING`
  return `${role} · STANDBY`
}

/**
 * P19 (operator: "when a agent is active/thinking, it should show a chat
 * bubble over that agent on the deck"): hold window for the reasoning-driven
 * thinking pill. Reasoning deltas arrive in bursts (REASONING_GAP_MS = 1500
 * segmentation); the pill holds 3s past the last delta so it never flickers
 * between deltas, then yields to the speech bubble.
 */
export const THINKING_PILL_HOLD_MS = 3000

/**
 * P19: reasoning/working signal evaluated per frame inside the tiny
 * ThinkingIndicator (not the whole scene) — the pill must switch off on the
 * clock even when no new events arrive (no parent re-render to lean on).
 */
export function makeThinkingPredicate(
  walker: Pick<WalkerState, 'agentId' | 'roleId' | 'stationTarget'>,
  floor: FloorState,
): () => boolean {
  return (): boolean => {
    // Working at a station (live tool call) — the original signal.
    if (walker.stationTarget !== null) return true
    const now = performance.now()
    // Reasoning attributed to THIS walker's id (subagent streams).
    const last = floor.reasoningClocks.get(walker.agentId)
    if (last !== undefined && now - last < THINKING_PILL_HOLD_MS) return true
    // Main-run reasoning arrives under the orchestrator's runtime id, which
    // is never a walker map entry (the orchestrator does not spawn itself).
    // Only the Savant centerpiece may claim recent non-walker reasoning,
    // and only while the run is live (savantPresent) — an idle floor with
    // stale clocks must never light up.
    if (walker.roleId === 'savant' && floor.savantPresent) {
      for (const [agentId, lastMs] of floor.reasoningClocks) {
        if (floor.walkers.has(agentId)) continue
        if (now - lastMs < THINKING_PILL_HOLD_MS) return true
      }
    }
    return false
  }
}
