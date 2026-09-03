/**
 * FID-2026-0822-012 P6 — ambient holographic atmosphere layer.
 *
 * A bounded pool of tiny SOLID additive-glow motes drifting slowly upward
 * through the grid volume gives the Void depth without a particle-system
 * dependency (asset pass: wireframes retired — operator directive
 * 2026-08-24: nothing on the deck is wireframe anymore).
 * Mote positions are PURE functions of the INJECTED clock (deterministic
 * replay discipline shared with WalkerLayer/StateFxLayer) — nothing
 * accumulates per frame, so context-loss rebuilds and reduced-motion
 * freezes are trivial and the layout is byte-stable across reloads.
 *
 * ponytail: ceiling=EffectComposer/bloom post-processing pass; upgrade=once
 * the live event driver proves the webview GPU budget — additive-feel low
 * opacity carries the hologram-glow read today, and a composer would have
 * to be rebuilt from scratch on every webglcontextrestored.
 */

import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
} from 'three'

import { DECK_ACCENTS } from '../deck-accents'

import type { Scene } from 'three'

/** Pool bound — pinned by test (bounded-resource rule). */
export const MOTE_COUNT = 96
/** Vertical wrap span; motes rise through [0, SPAN) forever. */
export const MOTE_HEIGHT_SPAN = 6

// FID-2026-0828-002 A: the original mote pass (radius 0.14, opacity 0.5,
// drift 0.45 u/s) was PERCEPTUALLY STATIC in the live webview — the operator
// read the whole deck as frozen even with the ticker running. Bounded
// retune: bigger geometry, brighter additive presence, and a drift speed
// that clears one body height in ~8s so upward motion is visible at camera
// distance ~34 without becoming a distraction.
// FID-2026-0829-001 L6: further increase mote visibility — bigger radius,
// higher opacity, faster drift so motes are unmistakably alive.
// FID-2026-0828-002 D: damping floor glow wash — reduced radius and opacity
// so additive blending compounds less at center; drift speed stays high
// so motion is visible (FID-0829-001 L6 preserved).
const MOTE_RADIUS = 0.28
const MOTE_OPACITY = 0.55
const MOTE_DRIFT_UNITS_PER_SEC = 2.2

const MOTE_AREA_RADIUS = 26

interface Mote {
  readonly mesh: Mesh<OctahedronGeometry, MeshBasicMaterial>
  readonly baseY: number
  readonly speedScale: number
}

function moteY(mote: Mote, nowMs: number): number {
  const rise = (nowMs / 1000) * MOTE_DRIFT_UNITS_PER_SEC * mote.speedScale
  return (mote.baseY + rise) % MOTE_HEIGHT_SPAN
}

export class AtmosphereLayer {
  private readonly root = new Group()
  private readonly motes: Mote[] = []
  private readonly geometry = new OctahedronGeometry(MOTE_RADIUS)
  private readonly material = new MeshBasicMaterial({
    color: new Color(DECK_ACCENTS.primary),
    transparent: true,
    opacity: MOTE_OPACITY,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  private reduced = false
  private disposed = false

  constructor(scene: Scene) {
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      // Golden-angle spiral spreads motes evenly with zero RNG — the layout
      // never varies between reloads or replay runs.
      const angle = i * 2.399963229728653
      const radius = MOTE_AREA_RADIUS * Math.sqrt((i + 0.5) / MOTE_COUNT)
      const mesh = new Mesh(this.geometry, this.material)
      const baseY = ((i * 0.6180339887498949) % 1) * MOTE_HEIGHT_SPAN
      mesh.position.set(
        Math.cos(angle) * radius,
        baseY,
        Math.sin(angle) * radius,
      )
      this.motes.push({
        mesh,
        baseY,
        speedScale: 0.6 + ((i * 0.7548776662466927) % 1) * 0.8,
      })
      this.root.add(mesh)
    }
    scene.add(this.root)
  }

  /** Reduced motion evaluates the same pure trajectory at t=0: layout stays. */
  setReduced(reduced: boolean): void {
    this.reduced = reduced
  }

  sync(nowMs: number): void {
    if (this.disposed) return
    const tMs = this.reduced ? 0 : nowMs
    for (const mote of this.motes) {
      mote.mesh.position.y = moteY(mote, tMs)
    }
  }

  /** Idempotent teardown — shared geometry/material disposed exactly once. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const mote of this.motes) this.root.remove(mote.mesh)
    this.motes.length = 0
    this.geometry.dispose()
    this.material.dispose()
    this.root.removeFromParent()
  }
}
