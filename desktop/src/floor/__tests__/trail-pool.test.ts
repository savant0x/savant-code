import { describe, expect, test } from 'bun:test'
import { Group, Mesh } from 'three'

import { MAX_TRAILS, TrailPool, TRAIL_LIFETIME_MS } from '../stage/trail-pool'

describe('walker trail pool (FID-2026-0822-012 P6)', () => {
  test('drop adds markers into the parent group (no scene child of its own)', () => {
    const parent = new Group()
    const pool = new TrailPool(parent)
    try {
      pool.drop('#18faf9', 1, 2, 0)
      expect(pool.size).toBe(1)
      expect(parent.children).toHaveLength(1)
    } finally {
      pool.dispose()
    }
  })

  test('the pool is FIFO-capped at MAX_TRAILS across drops', () => {
    const parent = new Group()
    const pool = new TrailPool(parent)
    try {
      for (let i = 0; i < MAX_TRAILS + 5; i += 1) {
        pool.drop('#18faf9', i, i, i)
      }
      expect(pool.size).toBe(MAX_TRAILS)
      expect(parent.children).toHaveLength(MAX_TRAILS)
    } finally {
      pool.dispose()
    }
  })

  test('markers fade linearly and expire past their lifetime', () => {
    const parent = new Group()
    const pool = new TrailPool(parent)
    try {
      pool.drop('#18faf9', 0, 0, 1000)
      const mesh = parent.children[0]
      expect(mesh instanceof Mesh).toBe(true)
      if (!(mesh instanceof Mesh)) throw new Error('trail mesh missing')
      const material = mesh.material as {
        opacity: number
        dispose(): void
      }
      // Halfway through the lifetime the opacity is half.
      pool.sync(1000 + TRAIL_LIFETIME_MS / 2)
      expect(material.opacity).toBeCloseTo(0.5, 5)
      // Past the lifetime the marker is gone.
      pool.sync(1000 + TRAIL_LIFETIME_MS + 1)
      expect(pool.size).toBe(0)
      expect(parent.children).toHaveLength(0)
    } finally {
      pool.dispose()
    }
  })

  test('dispose empties everything and is idempotent under double-mount', () => {
    const parent = new Group()
    const pool = new TrailPool(parent)
    pool.drop('#18faf9', 0, 0, 0)
    pool.dispose()
    expect(pool.size).toBe(0)
    expect(parent.children).toHaveLength(0)
    // Second dispose + post-dispose drop/sync are no-ops, not crashes.
    pool.dispose()
    pool.drop('#18faf9', 1, 1, 1)
    pool.sync(99999)
    expect(pool.size).toBe(0)
  })
})
