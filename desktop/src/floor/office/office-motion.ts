/**
 * FID-2026-0831-001 P1 — pure office motion math.
 *
 * Zero three.js imports, zero DOM: every function here is a pure function of
 * its inputs and an injected clock, so walk interpolation is unit-testable
 * exactly as the R3F scene consumes it per frame. Same discipline as
 * `adapter/floor-adapter.ts` (one truth, testable seam).
 *
 * Reduced-motion discipline (carried from the stage's `motion.ts`): when
 * reduced motion is requested, walkers TELEPORT to their target instead of
 * stepping — the state change is instant, never animated.
 */

/** Bounded walk speed in world units/second (crosses the desk ring in ~2s). */
export const WALK_SPEED_UNITS_PER_SEC = 8
/** Snap distance: closer than this counts as arrived (no jitter). */
export const ARRIVE_EPSILON = 0.05

export interface Vec2 {
  readonly x: number
  readonly z: number
}

/** True when the user asked the OS to minimize non-essential motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Straight-line distance on the floor plane. */
export function distance2d(from: Vec2, to: Vec2): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  return Math.hypot(dx, dz)
}

/**
 * Advance a walker one bounded step toward its target.
 *
 * Pure: returns a NEW position (never mutates). At bounded speed
 * `WALK_SPEED_UNITS_PER_SEC * dtMs / 1000`; arrives exactly (snaps) when the
 * remaining distance is within `ARRIVE_EPSILON` or smaller than the step.
 */
export function stepToward(from: Vec2, to: Vec2, dtMs: number): Vec2 {
  const total = distance2d(from, to)
  if (total <= ARRIVE_EPSILON) return { x: to.x, z: to.z }
  const maxStep = (WALK_SPEED_UNITS_PER_SEC * Math.max(dtMs, 0)) / 1000
  if (maxStep >= total) return { x: to.x, z: to.z }
  const fraction = maxStep / total
  return {
    x: from.x + (to.x - from.x) * fraction,
    z: from.z + (to.z - from.z) * fraction,
  }
}

/**
 * Full walk pose for one frame: where the character stands and whether it is
 * mid-walk (drives the walk-cycle bob in the scene layer).
 *
 * `reduced` short-circuits to the target instantly (teleport, no animation).
 */
export function walkPose(
  current: Vec2,
  target: Vec2,
  dtMs: number,
  reduced: boolean,
): { position: Vec2; walking: boolean } {
  if (reduced) return { position: { x: target.x, z: target.z }, walking: false }
  const position = stepToward(current, target, dtMs)
  return {
    position,
    walking: distance2d(position, target) > ARRIVE_EPSILON,
  }
}

/**
 * Deterministic idle bob: a tiny vertical sine so standing characters feel
 * alive without any randomness. Pure function of the injected clock.
 * Amplitude is intentionally small (0.05 units) — presence, not pogo.
 */
export function idleBob(nowMs: number, seed: number): number {
  const phase = (nowMs / 1000) * 1.4 + seed * 2.399963 // golden-angle spread
  return Math.sin(phase) * 0.05
}

/**
 * Deterministic walk-cycle bob: faster vertical bounce while moving.
 */
export function walkBob(nowMs: number, seed: number): number {
  const phase = (nowMs / 1000) * 9 + seed * 2.399963
  return Math.abs(Math.sin(phase)) * 0.08
}

/** Deterministic 0..1 hash from a number seed — used by roam helpers so the
 * wander path is stable for a given agent across frames (never flickers). */
function hash01(seed: number): number {
  let h = Math.imul(seed | 0, 374761393)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** How long an idle agent dwells before drifting to a new point (ms).
 * Pure: same (seed, epoch) collapses to the same dwell, so a wander target
 * is stable until the epoch rolls over. */
export function idleDwellMs(seed: number, epoch: number): number {
  // 2.5s–6.5s per wander, offset per agent so they never all move together.
  return 2500 + hash01(seed * 31 + epoch) * 4000
}

/** A deterministic in-bounds wander point for an idle agent (world units).
 * `kind` biases the destination: 'floor' drifts across the open area,
 * 'console' loiters near the command tile. Pure function of seed + epoch. */
export function roamPoint(
  seed: number,
  epoch: number,
  kind: 'floor' | 'console' = 'floor',
): Vec2 {
  const angle = hash01(seed * 17 + epoch) * Math.PI * 2
  if (kind === 'console') {
    // Hang around the command tile (radius 3.5–7) — never on the console
    // table itself, and always inside the floor.
    const radius = 3.5 + hash01(seed * 23 + epoch) * 3.5
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
  }
  // Open floor drift: radius 11–17, biased to avoid the exact center.
  const radius = 11 + hash01(seed * 29 + epoch) * 6
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
}

/** Turn a wander epoch (quantized seconds) for a given nowMs — the wander
 * target for an agent only changes when this integer advances. */
export function roamEpoch(nowMs: number): number {
  return Math.floor(nowMs / 1000)
}

// ─── FID-2026-0901-003 P9/P9c: routing + separation extracted ──────────────
// The obstacle-routing and separation cluster now lives in
// ./office-routing (FID-2026-0819-005 Loop 158) and is re-exported here —
// the public surface is unchanged.
export {
  AGENT_RADIUS,
  ROUTE_PAD,
  SEPARATION_DISTANCE,
  routeAround,
  segmentPointDistance,
  separationOffset,
} from './office-routing'
export type { WalkObstacle } from './office-routing'

// ─── FID-2026-0901-003: purposeful break fidgets ────────────────────────────
// The operator rejected AIMLESS roaming (P8) but asked the floor to feel
// "alive" again. The compromise: agents leave their desk only for a NAMED
// break destination (coffee machine, water cooler, couch, whiteboard), on a
// slow deterministic schedule, and always return to their post. Movement
// still has a reason — it just isn't tool traffic.

/** Break destinations an idle agent may visit (office-plan supplies the
 * coordinates; this module stays geometry-free). */
export type BreakKind = 'coffee' | 'water' | 'couch' | 'whiteboard'

/** How long an idle agent works before considering a break (ms). */
export function breakDwellMs(seed: number, epoch: number): number {
  // 12s–26s between breaks — ambient life, not a playground.
  return 12000 + hash01(seed * 37 + epoch) * 14000
}
/** How long an agent lingers at a break spot before heading back (ms). */
export function breakLingerMs(seed: number, epoch: number): number {
  return 4000 + hash01(seed * 41 + epoch) * 6000
}
/** Which break an agent takes this epoch — deterministic per seed+epoch. */
export function breakKindFor(seed: number, epoch: number): BreakKind {
  const kinds: readonly BreakKind[] = ['coffee', 'water', 'couch', 'whiteboard']
  return kinds[Math.floor(hash01(seed * 43 + epoch) * kinds.length)]
}
