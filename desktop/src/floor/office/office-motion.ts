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

// ─── FID-2026-0901-003 P9c: agent-vs-agent separation ───────────────────────

/** Minimum comfortable distance between two walking figures (center to
 * center): two body radii (AGENT_RADIUS = 0.45) plus a little social space.
 * A literal, not a derived constant — this section sits above the P9 block
 * that declares AGENT_RADIUS. */
export const SEPARATION_DISTANCE = 1.05

/**
 * Bounded push-away offset so walkers never pass through each other (P9c —
 * operator: "add subtle avoidance between agents"). For every other figure
 * closer than `minDist`, accumulate a half-strength push along the away axis;
 * the scene applies the summed offset to the walked position.
 *
 * Pure and deterministic: two coincident points get a fixed +X+Z nudge (no
 * random jitter), and the same crowd always produces the same offset. The
 * caller decides whether the result is safe to apply (e.g. not into a desk).
 */
export function separationOffset(
  self: Vec2,
  others: readonly Vec2[],
  minDist: number = SEPARATION_DISTANCE,
): Vec2 {
  let ox = 0
  let oz = 0
  for (const other of others) {
    const d = distance2d(self, other)
    if (d >= minDist) continue
    if (d < 1e-6) {
      // Perfectly coincident: a fixed deterministic nudge breaks the tie.
      ox += 0.1
      oz += 0.1
      continue
    }
    // Half the penetration depth, so two symmetric pushes resolve exactly.
    const push = ((minDist - d) / d) * 0.5
    ox += (self.x - other.x) * push
    oz += (self.z - other.z) * push
  }
  return { x: ox, z: oz }
}

// ─── FID-2026-0901-003 P9: obstacle-aware walk routing ─────────────────────

// ─── FID-2026-0901-003 P9: obstacle-aware walk routing ─────────────────────
/** A circular no-walk footprint (desks, furniture, the central pedestal). */
export interface WalkObstacle {
  readonly x: number
  readonly z: number
  readonly r: number
}

/** Body radius of a walking figure — added to every obstacle's footprint. */
export const AGENT_RADIUS = 0.45
/** Extra breathing room on top of body + footprint when routing around. */
export const ROUTE_PAD = 0.35

/** Shortest distance from `point` to the segment from→to (pure). */
export function segmentPointDistance(
  from: Vec2,
  to: Vec2,
  point: Vec2,
): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const lenSq = dx * dx + dz * dz
  if (lenSq < 1e-9) return distance2d(from, point)
  let t = ((point.x - from.x) * dx + (point.z - from.z) * dz) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(point.x - (from.x + dx * t), point.z - (from.z + dz * t))
}

/**
 * Waypoints for a walk from→to that detours around furniture footprints
 * (FID-2026-0901-003 P9 — operator: "agents walking through desks, not
 * around them").
 *
 * Worklist algorithm: each round finds the obstacle whose clearance zone the
 * remaining straight path most deeply violates and inserts ONE tangent detour
 * on the side away from the obstacle center, then re-checks the REMAINING
 * path — so a detour inserted for one desk can itself route around the next
 * one (a single greedy pass would cut corners). Terminates in ≤ 16 rounds.
 *
 * Obstacles that contain the start or destination are skipped — an agent
 * seated at its own desk may depart from inside that desk's zone, and must
 * be able to arrive at a break spot that hugs its furniture.
 *
 * Pure and deterministic: same inputs → same waypoints, so the scene can
 * recompute on target change without flicker.
 */
export function routeAround(
  from: Vec2,
  to: Vec2,
  obstacles: readonly WalkObstacle[],
): Vec2[] {
  // Start/destination containment window: how close an obstacle may sit to
  // the endpoints before it is treated as "the agent is already there".
  const SKIP_WINDOW = 0.9
  const waypoints: Vec2[] = []
  let start = from
  for (let round = 0; round < 16; round += 1) {
    // Find the DEEPEST clearance violation along the remaining path.
    let worst: { obs: WalkObstacle; clearance: number; depth: number } | null =
      null
    for (const obs of obstacles) {
      const clearance = obs.r + AGENT_RADIUS + ROUTE_PAD
      if (distance2d(start, obs) < clearance + SKIP_WINDOW) continue
      if (distance2d(to, obs) < clearance + SKIP_WINDOW) continue
      const d = segmentPointDistance(start, to, obs)
      const depth = clearance - d
      if (depth > 0 && (worst === null || depth > worst.depth)) {
        worst = { obs, clearance, depth }
      }
    }
    if (worst === null) break
    // Tangent detour on the side of the path away from the obstacle center.
    const segDx = to.x - start.x
    const segDz = to.z - start.z
    const len = Math.hypot(segDx, segDz)
    if (len < 1e-6) break
    const cross =
      segDx * (worst.obs.z - start.z) - segDz * (worst.obs.x - start.x)
    const side = cross >= 0 ? -1 : 1
    let t =
      ((worst.obs.x - start.x) * segDx + (worst.obs.z - start.z) * segDz) /
      (len * len)
    t = Math.max(0, Math.min(1, t))
    const closestX = start.x + segDx * t
    const closestZ = start.z + segDz * t
    const px = (-segDz / len) * side
    const pz = (segDx / len) * side
    const detour = {
      x: closestX + px * worst.clearance,
      z: closestZ + pz * worst.clearance,
    }
    waypoints.push(detour)
    start = detour
  }
  waypoints.push(to)
  return waypoints
}

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
