import { describe, expect, test } from 'bun:test'

import {
  BREAK_SPOTS,
  breakUseSpot,
  deskFaceTarget,
  homePosition,
  standSpot,
} from '../office-plan'

describe('break spots (FID-2026-0901-003)', () => {
  test('all four break kinds exist exactly once', () => {
    const kinds = BREAK_SPOTS.map((spot) => spot.kind).sort()
    expect(kinds).toEqual(['coffee', 'couch', 'water', 'whiteboard'])
  })

  test('break spots sit inside the floor and clear of the center emblem', () => {
    for (const spot of BREAK_SPOTS) {
      const radius = Math.hypot(spot.position.x, spot.position.z)
      expect(radius).toBeGreaterThan(5) // never on the command tile
      // Inside the 42x38 floor (half-extents 21 x 19).
      expect(Math.abs(spot.position.x)).toBeLessThan(21)
      expect(Math.abs(spot.position.z)).toBeLessThan(19)
    }
  })

  test('use spots are strictly closer to the room center than the furniture', () => {
    for (const spot of BREAK_SPOTS) {
      const use = breakUseSpot(spot.kind)
      const furnitureRadius = Math.hypot(spot.position.x, spot.position.z)
      const useRadius = Math.hypot(use.x, use.z)
      expect(useRadius).toBeLessThan(furnitureRadius)
    }
  })

  test('use spots are deterministic', () => {
    expect(breakUseSpot('coffee')).toEqual(breakUseSpot('coffee'))
  })
})

describe('desk seating geometry', () => {
  test('stand spots sit radially inward of their desk (seat side)', () => {
    for (let padIndex = 0; padIndex < 9; padIndex += 1) {
      const desk = homePosition(padIndex)
      const seat = standSpot(desk)
      const deskRadius = Math.hypot(desk.x, desk.z)
      const seatRadius = Math.hypot(seat.x, seat.z)
      expect(seatRadius).toBeLessThan(deskRadius)
    }
  })

  test('face targets sit radially outward of their desk (monitor side)', () => {
    for (let padIndex = 0; padIndex < 9; padIndex += 1) {
      const desk = homePosition(padIndex)
      const face = deskFaceTarget(desk)
      const deskRadius = Math.hypot(desk.x, desk.z)
      const faceRadius = Math.hypot(face.x, face.z)
      expect(faceRadius).toBeGreaterThan(deskRadius)
    }
  })
})
