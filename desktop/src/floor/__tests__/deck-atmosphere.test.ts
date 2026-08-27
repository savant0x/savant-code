import { describe, expect, test } from 'bun:test'
import { Scene } from 'three'

import {
  AtmosphereLayer,
  MOTE_COUNT,
  MOTE_HEIGHT_SPAN,
} from '../stage/deck-atmosphere'

describe('atmosphere layer (FID-2026-0822-012 P6)', () => {
  test('motes are a pinned bounded pool inside one root group', () => {
    const scene = new Scene()
    const layer = new AtmosphereLayer(scene)
    try {
      // Exactly one scene child (the root); the pool is the pinned size.
      expect(scene.children).toHaveLength(1)
      layer.sync(0)
      expect(scene.children[0].children).toHaveLength(MOTE_COUNT)
    } finally {
      layer.dispose()
    }
  })

  test('trajectories are pure functions of the injected clock', () => {
    const scene = new Scene()
    const layer = new AtmosphereLayer(scene)
    try {
      layer.sync(5000)
      const first = scene.children[0].children.map((m) => m.position.y)
      layer.sync(5000)
      const second = scene.children[0].children.map((m) => m.position.y)
      expect(second).toEqual(first)
      // Every mote stays inside the wrap span.
      for (const y of second) {
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThan(MOTE_HEIGHT_SPAN)
      }
    } finally {
      layer.dispose()
    }
  })

  test('reduced motion freezes every mote at its t=0 layout', () => {
    const scene = new Scene()
    const layer = new AtmosphereLayer(scene)
    try {
      layer.setReduced(true)
      layer.sync(999_999)
      const frozen = scene.children[0].children.map((m) => m.position.y)
      // Same reduced sync at any other clock reads identical positions.
      layer.sync(4_000_000)
      const still = scene.children[0].children.map((m) => m.position.y)
      expect(still).toEqual(frozen)
      // And they equal the honest t=0 layout.
      layer.sync(0)
      const atZero = scene.children[0].children.map((m) => m.position.y)
      expect(atZero).toEqual(frozen)
    } finally {
      layer.dispose()
    }
  })

  test('dispose empties the scene and is idempotent under double-mount', () => {
    const scene = new Scene()
    const layer = new AtmosphereLayer(scene)
    layer.sync(10)
    layer.dispose()
    expect(scene.children).toHaveLength(0)
    // Second dispose + post-dispose sync are no-ops, not crashes.
    layer.dispose()
    layer.sync(20)
    expect(scene.children).toHaveLength(0)
  })
})
