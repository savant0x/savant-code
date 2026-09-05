import { describe, expect, test } from 'bun:test'

import {
  ARRIVE_EPSILON,
  WALK_SPEED_UNITS_PER_SEC,
  breakDwellMs,
  breakKindFor,
  breakLingerMs,
  distance2d,
  idleBob,
  idleDwellMs,
  roamEpoch,
  roamPoint,
  stepToward,
  walkBob,
  walkPose,
} from '../office-motion'

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
