import { distance2d, type Vec2 } from './office-motion'

// FID-2026-0819-005 Loop 158: obstacle-aware walk routing + agent
// separation (FID-2026-0901-003 P9/P9c), extracted verbatim from
// office-motion.ts. Pure geometry; re-exported from office-motion.ts so
// the public surface is unchanged.

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

/** Minimum comfortable distance between two walking figures (center to
 * center): two body radii (AGENT_RADIUS = 0.45) plus a little social space.
 * A literal, not a derived constant — this section sits above the P9 block
 * that declares AGENT_RADIUS. */
export const SEPARATION_DISTANCE = 1.05

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
