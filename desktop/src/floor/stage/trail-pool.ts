/**
 * FID-2026-0822-012 P6 — walker trail markers.
 *
 * While a walker walks its pad<->station path it drops small fading
 * markers; the pool is FIFO-capped so a busy floor never accumulates
 * geometry, and markers age out deterministically off the same INJECTED
 * clock the rest of the stage uses (no per-frame accumulation, replay-safe).
 * Markers attach into the OWNING LAYER's root group — the pool adds no scene
 * children of its own, so existing layer child-count invariants hold.
 */

import { Color, Mesh, MeshBasicMaterial, OctahedronGeometry } from 'three'

import type { Group } from 'three'

/** Marker lifetime; opacity fades linearly to zero over this window. */
export const TRAIL_LIFETIME_MS = 1000
/** Hard FIFO cap across ALL walkers (spec-class bounded-resource rule). */
export const MAX_TRAILS = 128
/** Minimum clock gap between two markers on one walker's wake. */
export const TRAIL_SPACING_MS = 80

/** Trails hug the ground beneath the lane plane (LANE_HEIGHT_Y = 0.15). */
const TRAIL_Y = 0.06

interface Trail {
  readonly mesh: Mesh<OctahedronGeometry, MeshBasicMaterial>
  readonly bornMs: number
}

export class TrailPool {
  private readonly trails: Trail[] = []
  private disposed = false

  constructor(private readonly parent: Group) {}

  /** Live marker count (introspection for tests and the debug surface). */
  get size(): number {
    return this.trails.length
  }

  drop(accent: string, x: number, z: number, nowMs: number): void {
    if (this.disposed) return
    if (this.trails.length >= MAX_TRAILS) {
      const evicted = this.trails.shift()
      if (evicted !== undefined) this.disposeTrail(evicted)
    }
    const mesh = new Mesh(
      new OctahedronGeometry(0.12),
      new MeshBasicMaterial({
        color: new Color(accent),
        transparent: true,
        opacity: 1,
      }),
    )
    mesh.position.set(x, TRAIL_Y, z)
    this.trails.push({ mesh, bornMs: nowMs })
    this.parent.add(mesh)
  }

  /** Age-based fade + expiry, evaluated off the injected clock. */
  sync(nowMs: number): void {
    if (this.disposed) return
    for (const trail of this.trails) {
      const age = nowMs - trail.bornMs
      trail.mesh.material.opacity = Math.max(0, 1 - age / TRAIL_LIFETIME_MS)
    }
    while (
      this.trails.length > 0 &&
      nowMs - this.trails[0].bornMs > TRAIL_LIFETIME_MS
    ) {
      const expired = this.trails.shift()
      if (expired !== undefined) this.disposeTrail(expired)
    }
  }

  /** Idempotent teardown — safe under strict-mode double-mount. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const trail of this.trails) this.disposeTrail(trail)
    this.trails.length = 0
  }

  private disposeTrail(trail: Trail): void {
    this.parent.remove(trail.mesh)
    trail.mesh.geometry.dispose()
    trail.mesh.material.dispose()
  }
}
