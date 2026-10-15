import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_ORBIT,
  ZOOM_MAX_DISTANCE,
  ZOOM_MIN_DISTANCE,
  cameraPosition,
  clampDistance,
  clampDpr,
  nextDistance,
  panned,
} from '../stage/camera-controls'

const ORBIT = { ...DEFAULT_ORBIT, distance: 10 }

describe('deck camera math (FID-2026-0822-012 P1)', () => {
  test('clampDistance bounds the dolly range and absorbs non-finite input', () => {
    expect(clampDistance(4)).toBe(ZOOM_MIN_DISTANCE)
    expect(clampDistance(500)).toBe(ZOOM_MAX_DISTANCE)
    expect(clampDistance(34)).toBe(34)
    expect(clampDistance(Number.NaN)).toBe(DEFAULT_ORBIT.distance)
  })

  test('clampDpr keeps resolution inside [1,2] with safe fallbacks', () => {
    expect(clampDpr(0.5)).toBe(1)
    expect(clampDpr(1.75)).toBe(1.75)
    expect(clampDpr(3)).toBe(2)
    expect(clampDpr(Number.NaN)).toBe(1)
    expect(clampDpr(-1)).toBe(1)
  })

  test('wheel zoom dollies exponentially but clamps at the rails', () => {
    expect(nextDistance({ ...ORBIT }, -1000)).toBe(ZOOM_MIN_DISTANCE)
    expect(nextDistance({ ...ORBIT }, 2000)).toBe(ZOOM_MAX_DISTANCE)
    const closer = nextDistance({ ...ORBIT }, -100)
    expect(closer).toBeLessThan(10)
    expect(closer).toBeGreaterThan(ZOOM_MIN_DISTANCE)
  })

  test('pan at yaw=0 maps drag-right to -X and drag-down to -Z', () => {
    const next = panned(ORBIT, 100, 50)
    // scale = distance * DRAG_PAN_SCALE = 10 * 0.0018 = 0.018
    expect(next.targetX).toBeCloseTo(ORBIT.targetX - 1.8, 10)
    expect(next.targetZ).toBeCloseTo(ORBIT.targetZ - 0.9, 10)
  })

  test('pan rotates its axes with yaw', () => {
    const rotated = { ...ORBIT, yaw: Math.PI / 2 }
    const next = panned(rotated, 100, 50)
    expect(next.targetZ).toBeCloseTo(rotated.targetZ + 1.8, 6)
    expect(next.targetX).toBeCloseTo(rotated.targetX - 0.9, 6)
  })

  test('camera position orbits the target per pitch and yaw', () => {
    const overhead = cameraPosition({ ...ORBIT, pitch: Math.PI / 2, yaw: 0 })
    expect(overhead.x).toBeCloseTo(ORBIT.targetX, 10)
    expect(overhead.y).toBeCloseTo(10, 10)
    expect(overhead.z).toBeCloseTo(ORBIT.targetZ, 10)

    const groundLevel = cameraPosition({ ...ORBIT, pitch: 0 })
    expect(groundLevel.y).toBeCloseTo(0, 10)
    expect(groundLevel.z).toBeCloseTo(ORBIT.targetZ + 10, 10)
  })

  test('the default orbit sits inside every clamp rail', () => {
    expect(DEFAULT_ORBIT.distance).toBe(clampDistance(DEFAULT_ORBIT.distance))
  })
})
