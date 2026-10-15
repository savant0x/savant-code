import { describe, expect, test } from 'bun:test'

import {
  AGENT_RADIUS,
  distance2d,
  routeAround,
  separationOffset,
  segmentPointDistance,
} from '../office-motion'
import {
  TOOL_DESKS,
  WALK_OBSTACLES,
  deskPosition,
  homePosition,
  standSpot,
} from '../office-plan'

import type { WalkObstacle } from '../office-motion'

// FID-2026-0819-005 Loop 167: walk routing + agent separation suites
// split verbatim from office-motion.test.ts.

describe('walk routing (FID-2026-0901-003 P9)', () => {
  const DESK: WalkObstacle = { x: 0, z: 10, r: 2.4 }

  test('segmentPointDistance: midpoint crossing is exact', () => {
    expect(segmentPointDistance({ x: -5, z: 10 }, { x: 5, z: 10 }, DESK)).toBe(
      0,
    )
    expect(segmentPointDistance({ x: -5, z: 13 }, { x: 5, z: 13 }, DESK)).toBe(
      3,
    )
  })

  test('clear path yields a single waypoint (the destination)', () => {
    const points = routeAround({ x: -8, z: 18 }, { x: 8, z: 18 }, [DESK])
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({ x: 8, z: 18 })
  })

  test('path through a desk detours around it', () => {
    const from = { x: -8, z: 10 }
    const to = { x: 8, z: 10 }
    const points = routeAround(from, to, [DESK])
    expect(points.length).toBe(2) // one detour + destination
    for (const point of points) {
      // Every waypoint (and by construction the walked path between them)
      // keeps body + padding clearance from the desk center.
      expect(distance2d(point, DESK)).toBeGreaterThanOrEqual(
        DESK.r + AGENT_RADIUS,
      )
    }
  })

  test('obstacles containing start or destination are skipped (seated agent)', () => {
    // Start INSIDE the desk's clearance zone — must not detour its own desk.
    const from = { x: 0, z: 9 }
    const to = { x: 0, z: -10 }
    const points = routeAround(from, to, [DESK])
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual(to)
  })

  test('full office layout: desk-to-desk legs never cross another desk footprint', () => {
    // Every home-desk → every tool-desk route: each segment of the returned
    // path must clear every obstacle (the invariant the scene relies on).
    for (let fromPad = 0; fromPad < 9; fromPad += 1) {
      const seat = standSpot(homePosition(fromPad))
      for (const desk of TOOL_DESKS) {
        const target = standSpot(deskPosition(desk.id))
        const points = routeAround(seat, target, WALK_OBSTACLES)
        let prev = seat
        for (const point of points) {
          for (const obs of WALK_OBSTACLES) {
            // Endpoints may sit inside their own zones; mid-path waypoints
            // must clear everything.
            const d = segmentPointDistance(prev, point, obs)
            const endpointSkip =
              distance2d(prev, obs) < obs.r + 1.5 ||
              distance2d(point, obs) < obs.r + 1.5
            if (!endpointSkip) {
              // Tolerance 0.25: near a destination the router deliberately
              // relaxes (the agent must be able to ARRIVE at its own desk),
              // so a leg may graze the idealized circle by a few cm there.
              // Mid-floor the margin holds at full body clearance.
              expect(d).toBeGreaterThanOrEqual(obs.r + AGENT_RADIUS - 0.25)
            }
          }
          prev = point
        }
      }
    }
  })

  test('routing is deterministic (same inputs, same waypoints)', () => {
    const a = routeAround({ x: -8, z: 10 }, { x: 8, z: 10 }, [DESK])
    const b = routeAround({ x: -8, z: 10 }, { x: 8, z: 10 }, [DESK])
    expect(a).toEqual(b)
  })
})

describe('agent separation (FID-2026-0901-003 P9c)', () => {
  test('distant figures get zero push', () => {
    const push = separationOffset({ x: 0, z: 0 }, [{ x: 10, z: 0 }])
    expect(push.x).toBe(0)
    expect(push.z).toBe(0)
  })

  test('close figures push apart along the away axis', () => {
    const push = separationOffset({ x: 0, z: 0 }, [{ x: 0.4, z: 0 }])
    expect(push.x).toBeLessThan(0) // pushed away (−X, other is at +X)
    expect(push.z).toBe(0)
  })

  test('push is bounded to half the penetration per neighbor', () => {
    // Touching distance: penetration ~0.55 → push ~0.27, never a teleport.
    const push = separationOffset({ x: 0, z: 0 }, [{ x: 0.5, z: 0 }])
    expect(Math.abs(push.x)).toBeLessThan(0.3)
  })

  test('coincident figures get the deterministic +X+Z nudge', () => {
    const push = separationOffset({ x: 3, z: 3 }, [{ x: 3, z: 3 }])
    expect(push.x).toBe(0.1)
    expect(push.z).toBe(0.1)
  })

  test('deterministic: same crowd, same offset', () => {
    const crowd = [
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: 5, z: 5 },
    ]
    expect(separationOffset({ x: 0, z: 0 }, crowd)).toEqual(
      separationOffset({ x: 0, z: 0 }, crowd),
    )
  })
})
