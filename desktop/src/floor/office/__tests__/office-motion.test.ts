import { describe, expect, test } from 'bun:test'

import {
  ARRIVE_EPSILON,
  AGENT_RADIUS,
  WALK_SPEED_UNITS_PER_SEC,
  breakDwellMs,
  breakKindFor,
  breakLingerMs,
  distance2d,
  idleBob,
  idleDwellMs,
  routeAround,
  roamEpoch,
  roamPoint,
  separationOffset,
  segmentPointDistance,
  stepToward,
  walkBob,
  walkPose,
} from '../office-motion'
import {
  WALK_OBSTACLES,
  deskPosition,
  homePosition,
  standSpot,
  TOOL_DESKS,
} from '../office-plan'

import type { WalkObstacle } from '../office-motion'

describe('distance2d', () => {
  test('computes straight-line distance', () => {
    expect(distance2d({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5)
  })

  test('same point is zero', () => {
    expect(distance2d({ x: 2, z: 3 }, { x: 2, z: 3 })).toBe(0)
  })
})

describe('stepToward', () => {
  test('moves at bounded speed toward target', () => {
    const next = stepToward({ x: 0, z: 0 }, { x: 10, z: 0 }, 500)
    expect(next.x).toBeCloseTo(WALK_SPEED_UNITS_PER_SEC * 0.5)
    expect(next.z).toBe(0)
  })

  test('never overshoots the target', () => {
    const next = stepToward({ x: 9.9, z: 0 }, { x: 10, z: 0 }, 60_000)
    expect(next.x).toBe(10)
    expect(next.z).toBe(0)
  })

  test('already arrived returns target exactly', () => {
    const next = stepToward({ x: 10, z: 0 }, { x: 10, z: 0 }, 500)
    expect(next).toEqual({ x: 10, z: 0 })
  })

  test('negative dtMs never moves backwards', () => {
    const next = stepToward({ x: 0, z: 0 }, { x: 10, z: 0 }, -500)
    expect(next).toEqual({ x: 0, z: 0 })
  })

  test('diagonal movement preserves direction', () => {
    const next = stepToward({ x: 0, z: 0 }, { x: 3, z: 4 }, 100)
    const traveled = distance2d({ x: 0, z: 0 }, next)
    expect(traveled).toBeCloseTo(WALK_SPEED_UNITS_PER_SEC * 0.1)
  })
})

describe('walkPose', () => {
  test('walking is true while en route', () => {
    const pose = walkPose({ x: 0, z: 0 }, { x: 10, z: 0 }, 100, false)
    expect(pose.walking).toBe(true)
  })

  test('walking is false once arrived', () => {
    const pose = walkPose({ x: 9.99, z: 0 }, { x: 10, z: 0 }, 100, false)
    expect(pose.walking).toBe(false)
  })

  test('reduced motion teleports instantly', () => {
    const pose = walkPose({ x: 0, z: 0 }, { x: 10, z: 0 }, 16, true)
    expect(pose.position).toEqual({ x: 10, z: 0 })
    expect(pose.walking).toBe(false)
  })
})

describe('idleBob / walkBob', () => {
  test('idle bob stays within ±0.05 amplitude', () => {
    for (let ms = 0; ms < 5000; ms += 137) {
      const value = idleBob(ms, 3)
      expect(Math.abs(value)).toBeLessThanOrEqual(0.05 + 1e-9)
    }
  })

  test('idle bob is deterministic for same inputs', () => {
    expect(idleBob(1234, 7)).toBe(idleBob(1234, 7))
  })

  test('walk bob stays within ±0.08 amplitude', () => {
    for (let ms = 0; ms < 5000; ms += 137) {
      const value = walkBob(ms, 2)
      expect(Math.abs(value)).toBeLessThanOrEqual(0.08 + 1e-9)
    }
  })

  test('ARRIVE_EPSILON is small enough to avoid visible snapping', () => {
    expect(ARRIVE_EPSILON).toBeLessThan(0.1)
  })
})

describe('idleDwellMs / roamPoint / roamEpoch (P7 roaming)', () => {
  test('idleDwellMs is deterministic for same seed+epoch', () => {
    expect(idleDwellMs(7, 3)).toBe(idleDwellMs(7, 3))
  })

  test('idleDwellMs stays within a bounded window (2.5s–6.5s)', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      for (let epoch = 0; epoch < 10; epoch += 1) {
        const dwell = idleDwellMs(seed, epoch)
        expect(dwell).toBeGreaterThanOrEqual(2500)
        expect(dwell).toBeLessThanOrEqual(6500)
      }
    }
  })

  test('roamPoint is deterministic for same seed+epoch+kind', () => {
    expect(roamPoint(3, 5, 'floor')).toEqual(roamPoint(3, 5, 'floor'))
  })

  test('floor roam points are in-bounds (11–17 radius)', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const p = roamPoint(seed, 1, 'floor')
      const radius = Math.hypot(p.x, p.z)
      expect(radius).toBeGreaterThanOrEqual(11)
      expect(radius).toBeLessThanOrEqual(17)
    }
  })

  test('console roam points stay near center (3.5–7 radius, off the tile)', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const p = roamPoint(seed, 1, 'console')
      const radius = Math.hypot(p.x, p.z)
      expect(radius).toBeGreaterThanOrEqual(3.5)
      expect(radius).toBeLessThanOrEqual(7)
    }
  })

  test('roamEpoch quantizes time into whole seconds', () => {
    expect(roamEpoch(1999)).toBe(1)
    expect(roamEpoch(2000)).toBe(2)
  })
})

describe('break fidgets (FID-2026-0901-003)', () => {
  test('breakDwellMs is deterministic and bounded (12s–26s)', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      for (let epoch = 0; epoch < 3; epoch += 1) {
        const dwell = breakDwellMs(seed, epoch)
        expect(dwell).toBe(breakDwellMs(seed, epoch))
        expect(dwell).toBeGreaterThanOrEqual(12000)
        expect(dwell).toBeLessThanOrEqual(26000)
      }
    }
  })

  test('breakLingerMs is deterministic and bounded (4s–10s)', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const linger = breakLingerMs(seed, 2)
      expect(linger).toBe(breakLingerMs(seed, 2))
      expect(linger).toBeGreaterThanOrEqual(4000)
      expect(linger).toBeLessThanOrEqual(10000)
    }
  })

  test('breakKindFor only returns the four break kinds, deterministically', () => {
    const valid = new Set(['coffee', 'water', 'couch', 'whiteboard'])
    for (let seed = 0; seed < 30; seed += 1) {
      const kind = breakKindFor(seed, 7)
      expect(valid.has(kind)).toBe(true)
      expect(breakKindFor(seed, 7)).toBe(kind)
    }
  })

  test('break kinds vary across epochs (not locked to one destination)', () => {
    const seen = new Set<string>()
    for (let epoch = 0; epoch < 40; epoch += 1) {
      seen.add(breakKindFor(5, epoch))
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

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
