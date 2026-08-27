/**
 * FID-2026-0822-012 P3 + asset pass — deck station pedestal layer.
 *
 * Renders the six tool-class pedestals (File Forge, Command Spire, Signal
 * Array, Cartography Table, External Gate, Approval Gate) at their hexagon
 * positions from the pure station registry. The visual rework (operator
 * directive 2026-08-24: the v1 columns read as "Mario tubes") replaces the
 * single cylinder with a holographic landing pad: a tiered base disc, two
 * emissive concentric rings, a slim projector mast, a slowly spinning
 * floating core, and an additive light beam — the core burns brighter and
 * the beam thickens while the station is BUSY. All solid surfaces share
 * the hologram recipe; the beam is the one additive MeshBasicMaterial (the
 * research doc's no-composer glow). The core spin is a pure function of the
 * injected clock (deck clock discipline); `dispose()` tears everything
 * down idempotently.
 */

import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  TorusGeometry,
} from 'three'

import { DECK_TOKENS } from '../deck-tokens.generated'
import {
  STATION_ACCENTS,
  STATION_COUNT,
  STATION_IDS,
  STATION_LABELS,
  stationPosition,
} from '../stations'
import { createHologramMaterial, STATION_EMISSIVE } from './hologram-material'
import { createNameplate } from './nameplate'

import type { StationId } from '../stations'
import type { Nameplate } from './nameplate'
import type { BufferGeometry, MeshStandardMaterial, Scene } from 'three'

/** Pad proportions (world units) — extracted, no magic numbers inline. */
const BASE_BOTTOM_RADIUS = 0.9
const BASE_TOP_RADIUS = 0.75
const BASE_HEIGHT = 0.18
const PAD_RING_RADIUS = 0.82
const PAD_RING_TUBE = 0.045
const INNER_RING_RADIUS = 0.45
const INNER_RING_TUBE = 0.03
const MAST_BOTTOM_RADIUS = 0.14
const MAST_TOP_RADIUS = 0.1
const MAST_HEIGHT = 1.1
const CORE_RADIUS = 0.22
const CORE_HOVER_HEIGHT = 1.55
const BEAM_BOTTOM_RADIUS = 0.32
const BEAM_TOP_RADIUS = 0.16
/** Emissive levels — rings glow hard; the core burns brighter when BUSY. */
const RING_EMISSIVE = 0.9
const CORE_EMISSIVE = 0.7
const CORE_EMISSIVE_BUSY = 1.2
const BEAM_OPACITY = 0.1
const BEAM_OPACITY_BUSY = 0.22
/** Deterministic core spin (deck clock discipline — injected clock only). */
const CORE_SPIN_RAD_PER_SEC = 0.8

interface StationParts {
  readonly core: Mesh<OctahedronGeometry, MeshStandardMaterial>
  readonly beam: Mesh<CylinderGeometry, MeshBasicMaterial>
}

export class StationLayer {
  private readonly root = new Group()
  private readonly materials: MeshStandardMaterial[] = []
  private readonly beamMaterials: MeshBasicMaterial[] = []
  private readonly geometries: BufferGeometry[] = []
  private readonly nameplates: Nameplate[] = []
  private readonly parts: (StationParts | null)[] = []
  private readonly busy: boolean[] = []
  private disposed = false

  constructor(scene: Scene) {
    for (let index = 0; index < STATION_COUNT; index += 1) {
      const accent = STATION_ACCENTS[index] ?? DECK_TOKENS.primary
      const chassis = createHologramMaterial(accent, STATION_EMISSIVE)
      const ringMaterial = createHologramMaterial(accent, RING_EMISSIVE)
      this.materials.push(chassis, ringMaterial)

      // Tiered landing-pad base: wider foot, tapered top.
      const base = new CylinderGeometry(
        BASE_TOP_RADIUS,
        BASE_BOTTOM_RADIUS,
        BASE_HEIGHT,
        24,
      )
      // Slim projector mast — a mast, not a pipe.
      const mast = new CylinderGeometry(
        MAST_TOP_RADIUS,
        MAST_BOTTOM_RADIUS,
        MAST_HEIGHT,
        12,
      )
      // Concentric emissive rings on the pad surface.
      const padRing = new TorusGeometry(PAD_RING_RADIUS, PAD_RING_TUBE, 10, 40)
      const innerRing = new TorusGeometry(
        INNER_RING_RADIUS,
        INNER_RING_TUBE,
        8,
        32,
      )
      // Floating hologram core + its projector beam.
      const coreGeometry = new OctahedronGeometry(CORE_RADIUS)
      const beam = new CylinderGeometry(
        BEAM_TOP_RADIUS,
        BEAM_BOTTOM_RADIUS,
        CORE_HOVER_HEIGHT - BASE_HEIGHT,
        16,
        1,
        true,
      )
      this.geometries.push(base, mast, padRing, innerRing, coreGeometry, beam)

      const baseMesh = new Mesh(base, chassis)
      baseMesh.position.y = BASE_HEIGHT / 2
      const padRingMesh = new Mesh(padRing, ringMaterial)
      padRingMesh.rotation.x = Math.PI / 2
      padRingMesh.position.y = BASE_HEIGHT + 0.02
      const innerRingMesh = new Mesh(innerRing, ringMaterial)
      innerRingMesh.rotation.x = Math.PI / 2
      innerRingMesh.position.y = BASE_HEIGHT + 0.03
      const mastMesh = new Mesh(mast, chassis)
      mastMesh.position.y = BASE_HEIGHT + MAST_HEIGHT / 2
      const coreMesh: StationParts['core'] = new Mesh(
        coreGeometry,
        createHologramMaterial(accent, CORE_EMISSIVE),
      )
      coreMesh.position.y = CORE_HOVER_HEIGHT
      coreMesh.frustumCulled = false
      const beamMaterial = new MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: BEAM_OPACITY,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      })
      this.beamMaterials.push(beamMaterial)
      const beamMesh: StationParts['beam'] = new Mesh(beam, beamMaterial)
      beamMesh.position.y = BASE_HEIGHT + (CORE_HOVER_HEIGHT - BASE_HEIGHT) / 2

      const group = new Group()
      group.add(
        baseMesh,
        padRingMesh,
        innerRingMesh,
        mastMesh,
        coreMesh,
        beamMesh,
      )

      const stationId = STATION_IDS[index]
      const nameplate = createNameplate({
        title: STATION_LABELS[stationId],
        subtitle: 'station',
        accent,
        statusLabels: { active: 'BUSY', idle: 'IDLE' },
        worldWidth: 2.8,
      })
      nameplate.sprite.position.y = CORE_HOVER_HEIGHT + 0.75
      group.add(nameplate.sprite)
      this.nameplates.push(nameplate)
      this.parts.push({ core: coreMesh, beam: beamMesh })
      this.busy.push(false)
      const pad = stationPosition(index)
      group.position.set(pad.x, 0, pad.z)
      this.root.add(group)
    }
    scene.add(this.root)
  }

  /** Deterministic core spin — pure function of the injected clock. */
  sync(nowMs: number): void {
    if (this.disposed) return
    const spin = (nowMs / 1000) * CORE_SPIN_RAD_PER_SEC
    for (const part of this.parts) {
      if (part !== null) part.core.rotation.y = spin
    }
  }

  /**
   * Flip station chips to BUSY while an active walker targets (or works)
   * the pedestal; the core burns brighter and the beam thickens to match.
   * Called per tick from the live runtime; the nameplate content cache
   * makes unchanged ticks free.
   */
  syncBusy(busyStations: ReadonlySet<StationId>): void {
    if (this.disposed) return
    for (let index = 0; index < STATION_COUNT; index += 1) {
      const busy = busyStations.has(STATION_IDS[index])
      this.busy[index] = busy
      this.nameplates[index]?.update(busy)
      const part = this.parts[index]
      if (part !== null) {
        part.core.material.emissiveIntensity = busy
          ? CORE_EMISSIVE_BUSY
          : CORE_EMISSIVE
        part.beam.material.opacity = busy ? BEAM_OPACITY_BUSY : BEAM_OPACITY
      }
    }
  }

  /** Last-applied busy state (tests + analytical-fallback parity). */
  isBusy(index: number): boolean {
    return this.busy[index] ?? false
  }

  /** Last-applied core rotation (tests + analytical-fallback parity). */
  coreSpin(index: number): number {
    return this.parts[index]?.core.rotation.y ?? 0
  }

  /** Idempotent teardown — safe under strict-mode double-mount. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    for (const beamMaterial of this.beamMaterials) beamMaterial.dispose()
    for (const nameplate of this.nameplates) nameplate.dispose()
    this.geometries.length = 0
    this.materials.length = 0
    this.beamMaterials.length = 0
    this.nameplates.length = 0
    this.parts.length = 0
    this.root.removeFromParent()
  }
}
