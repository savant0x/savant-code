/**
 * FID-2026-0822-012 P4+P5 — deck state-effects layer.
 *
 * Renders the AMENDMENT-FREE state visuals derived from pure FloorState:
 *  - FSM AURA: a flat ring around the console tinted by the G2-paired phase
 *    (`phaseAccent`); hidden until a transition_phase result pairs, and
 *    `unknown` renders muted. The interim pairing rule EXPIRES per G2 when
 *    the amendment adds a dedicated phase event — this module consumes only
 *    `FloorState.fsmPhase`, so expiry is a one-line adapter change later.
 *  - SPARK BURSTS: every new `lastPulse.seq` fires a small wireframe burst at
 *    the attributed walker's home pad (null attribution => console). Sparks
 *    live briefly and are FIFO-capped well under the spec's 512 bound.
 *  - PACKET LANES: one beam + ping-pong packet per active walker between its
 *    pad and the console. v1 packets ping-pong deterministically; directional
 *    flow keyed to in-flight tools lands with the live driver (recorded
 *    boundary).
 *  - THINKER GLYPHS (P5): a flat ring of up to eight octahedron tiles above
 *    the console — one per segmented reasoning burst (`thinkerBursts`),
 *    newest brightest; deterministic pulse via the injected clock.
 *
 * Animation contract: `sync(floor, nowMs)` takes the injected clock — same
 * deterministic-replay discipline as WalkerLayer; nothing spins on its own.
 */

import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  TorusGeometry,
} from 'three'

import {
  padPosition,
  THINKER_BURST_CAP,
  type FloorState,
  type PadPosition,
  type WalkerState,
} from '../adapter/floor-adapter'
import { DECK_TOKENS } from '../deck-tokens.generated'
import { phaseAccent, stationIndex, stationPosition } from '../stations'

import type { AnimationSyncOptions } from './motion'
import type { Scene } from 'three'

export interface WalkerWorldPosition {
  readonly agentId: string
  readonly x: number
  readonly z: number
}

const SPARK_LIFETIME_MS = 900
const MAX_LIVE_SPARKS = 96
const SPARKS_PER_BURST = 8
/** Outward drift speed so bursts visibly scatter (audit fix: dir fields
 * were stored but never applied). */
const SPARK_SPEED_UNITS_PER_SEC = 8
const AURA_RADIUS = 2.6
const PACKET_PERIOD_MS = 2400
/** Glyph-ring geometry/pulse (P5): flat ring of tiles above the console. */
const GLYPH_RADIUS = 1.3
const GLYPH_Y = 2.5
const GLYPH_PERIOD_MS = 2000

interface Spark {
  readonly mesh: Mesh
  readonly bornMs: number
  readonly startX: number
  readonly startZ: number
  readonly dirX: number
  readonly dirZ: number
}

interface Lane {
  readonly packet: Mesh
  beam: Group
  target: PadPosition
}

function disposeMesh(mesh: Mesh): void {
  mesh.geometry.dispose()
  ;(mesh.material as MeshBasicMaterial).dispose()
}

export class StateFxLayer {
  private readonly root = new Group()
  private readonly aura: Mesh<TorusGeometry, MeshBasicMaterial>
  private readonly glyphs: Mesh<OctahedronGeometry, MeshBasicMaterial>[] = []
  private readonly sparks: Spark[] = []
  private readonly lanes = new Map<string, Lane>()
  private lastPulseSeq = 0
  private lastPhase: string | null = null
  private disposed = false

  constructor(scene: Scene) {
    this.aura = new Mesh(
      new TorusGeometry(AURA_RADIUS, 0.05, 6, 48),
      new MeshBasicMaterial({
        color: new Color(DECK_TOKENS.muted),
        transparent: true,
        opacity: 0.7,
      }),
    )
    this.aura.rotation.x = Math.PI / 2
    this.aura.position.y = 0.1
    this.aura.visible = false
    this.root.add(this.aura)
    for (let i = 0; i < THINKER_BURST_CAP; i += 1) {
      const angle = (i / THINKER_BURST_CAP) * Math.PI * 2
      const glyph = new Mesh(
        new OctahedronGeometry(0.16),
        new MeshBasicMaterial({
          color: new Color(DECK_TOKENS.inlineCodeFg),
          transparent: true,
          opacity: 0.4,
        }),
      )
      glyph.rotation.x = Math.PI / 2
      glyph.position.set(
        Math.sin(angle) * GLYPH_RADIUS,
        GLYPH_Y,
        Math.cos(angle) * GLYPH_RADIUS,
      )
      glyph.visible = false
      this.glyphs.push(glyph)
      this.root.add(glyph)
    }
    scene.add(this.root)
  }

  /**
   * `options.reduced` freezes all decorative motion: glyph pulse locks at
   * scale 1, sparks stay at their burst origin while still aging out, and
   * lane packets park at the lane midpoint. State-truth visibility (aura,
   * lit glyphs, lane existence) is unchanged.
   */
  sync(
    floor: FloorState,
    nowMs: number,
    options: AnimationSyncOptions = {},
    positions?: ReadonlyMap<string, WalkerWorldPosition>,
  ): void {
    if (this.disposed) return
    const reduced = options.reduced === true
    this.syncAura(floor.fsmPhase)
    this.syncSparks(floor, nowMs, reduced)
    this.syncLanes(floor, nowMs, reduced, positions)
    this.syncGlyphs(floor.thinkerBursts.length, nowMs, reduced)
  }

  /** Idempotent teardown — safe under strict-mode double-mount. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const spark of this.sparks) disposeMesh(spark.mesh)
    this.sparks.length = 0
    for (const lane of this.lanes.values()) {
      disposeMesh(lane.packet)
      lane.beam.traverse((child) => {
        if (child instanceof Mesh) disposeMesh(child)
      })
    }
    this.lanes.clear()
    for (const glyph of this.glyphs) disposeMesh(glyph)
    disposeMesh(this.aura)
    this.root.removeFromParent()
  }

  /** Glyph ring: tile i lights for burst i; newest bursts burn brightest. */
  private syncGlyphs(
    burstCount: number,
    nowMs: number,
    reduced: boolean,
  ): void {
    for (let i = 0; i < this.glyphs.length; i += 1) {
      const glyph = this.glyphs[i]
      const lit = i < burstCount
      glyph.visible = lit
      if (!lit) continue
      // Newest (highest index) burns brightest; gentle clock pulse scales it.
      const recency = (i + 1) / burstCount
      glyph.material.opacity = 0.35 + recency * 0.55
      glyph.scale.setScalar(
        reduced
          ? 1
          : 1 + Math.sin((nowMs / GLYPH_PERIOD_MS) * Math.PI * 2 + i) * 0.12,
      )
    }
  }

  private syncAura(phase: string | null): void {
    if (phase === null) {
      this.aura.visible = false
      this.lastPhase = null
      return
    }
    if (phase !== this.lastPhase) {
      this.lastPhase = phase
      this.aura.material.color.set(phaseAccent(phase))
    }
    this.aura.visible = true
  }

  private syncSparks(floor: FloorState, nowMs: number, reduced: boolean): void {
    const pulse = floor.lastPulse
    if (pulse !== null && pulse.seq > this.lastPulseSeq) {
      this.lastPulseSeq = pulse.seq
      const walker =
        pulse.agentId !== null ? floor.walkers.get(pulse.agentId) : undefined
      const origin =
        walker !== undefined ? padPosition(walker.padIndex) : { x: 0, z: 0 }
      this.spawnBurst(origin.x, origin.z, nowMs)
    }
    // Drift outward from the burst origin (elapsed clamped at lifetime);
    // reduced motion holds every spark at its origin while it ages out.
    for (const spark of this.sparks) {
      if (reduced) continue
      const elapsedS = Math.min(nowMs - spark.bornMs, SPARK_LIFETIME_MS) / 1000
      const travel = SPARK_SPEED_UNITS_PER_SEC * elapsedS
      spark.mesh.position.x = spark.startX + spark.dirX * travel
      spark.mesh.position.z = spark.startZ + spark.dirZ * travel
    }
    // Age out expired sparks (FIFO cap enforced at spawn time).
    while (
      this.sparks.length > 0 &&
      nowMs - this.sparks[0].bornMs > SPARK_LIFETIME_MS
    ) {
      const expired = this.sparks.shift()
      if (expired !== undefined) disposeMesh(expired.mesh)
    }
  }

  private spawnBurst(x: number, z: number, nowMs: number): void {
    for (let i = 0; i < SPARKS_PER_BURST; i += 1) {
      if (this.sparks.length >= MAX_LIVE_SPARKS) {
        const evicted = this.sparks.shift()
        if (evicted !== undefined) disposeMesh(evicted.mesh)
      }
      const angle = (i / SPARKS_PER_BURST) * Math.PI * 2
      const mesh = new Mesh(
        new OctahedronGeometry(0.18),
        new MeshBasicMaterial({ color: new Color(DECK_TOKENS.primary) }),
      )
      mesh.position.set(x, LANE_HEIGHT_Y(), z)
      this.sparks.push({
        mesh,
        bornMs: nowMs,
        startX: x,
        startZ: z,
        dirX: Math.sin(angle),
        dirZ: Math.cos(angle),
      })
      this.root.add(mesh)
    }
  }

  private syncLanes(
    floor: FloorState,
    nowMs: number,
    reduced: boolean,
    positions?: ReadonlyMap<string, WalkerWorldPosition>,
  ): void {
    const active = new Set<string>()
    for (const [agentId, walker] of floor.walkers) {
      if (walker.phase !== 'active') continue
      active.add(agentId)
      const target = positions?.get(agentId) ?? laneTarget(walker)
      let lane = this.lanes.get(agentId)
      if (lane === undefined) {
        lane = this.buildLane(target)
        this.lanes.set(agentId, lane)
        this.root.add(lane.beam)
        this.root.add(lane.packet)
      } else if (!samePosition(lane.target, target)) {
        // A walker can be observed first at its home pad, then receive a
        // tool_call and move to a station. Repoint the existing lane instead
        // of leaving the beam/dot at the stale pad endpoint.
        this.root.remove(lane.beam)
        lane.beam.traverse((child) => {
          if (child instanceof Mesh) disposeMesh(child)
        })
        lane.beam = this.buildBeam(target)
        lane.target = target
        this.root.add(lane.beam)
      }
      // Ping-pong 0..1..0 over the period; deterministic in replay.
      // Reduced motion parks the packet at the exact lane midpoint.
      const t = (nowMs % PACKET_PERIOD_MS) / PACKET_PERIOD_MS
      const u = reduced ? 0.5 : t <= 0.5 ? t * 2 : 2 - t * 2
      lane.packet.position.set(target.x * u, LANE_HEIGHT_Y(), target.z * u)
    }
    for (const [agentId, lane] of this.lanes) {
      if (active.has(agentId)) continue
      this.root.remove(lane.beam)
      this.root.remove(lane.packet)
      disposeMesh(lane.packet)
      lane.beam.traverse((child) => {
        if (child instanceof Mesh) disposeMesh(child)
      })
      this.lanes.delete(agentId)
    }
  }

  private buildLane(target: PadPosition): Lane {
    const beam = this.buildBeam(target)
    const packet = new Mesh(
      new OctahedronGeometry(0.22),
      new MeshBasicMaterial({ color: new Color(DECK_TOKENS.inlineCodeFg) }),
    )
    return { beam, packet, target }
  }

  private buildBeam(target: PadPosition): Group {
    const material = new MeshBasicMaterial({
      color: new Color(DECK_TOKENS.border),
      transparent: true,
      opacity: 0.9,
    })
    const length = Math.hypot(target.x, target.z)
    const beam = new Group()
    const strip = new Mesh(new BoxGeometry(length, 0.04, 0.08), material)
    // FID-2026-0828-002 D-fix: local +X aligned with the console→target
    // radial. Strip centered at beam origin (midpoint) so it spans the
    // full console→target distance. The old PI/2 offset ran strips
    // tangent to the ring; the old -length/2 shift covered only half.
    beam.rotation.y = Math.atan2(target.x, target.z)
    strip.position.y = LANE_HEIGHT_Y()
    beam.add(strip)
    beam.position.set(target.x / 2, 0, target.z / 2)
    return beam
  }
}

function samePosition(left: PadPosition, right: PadPosition): boolean {
  return Math.abs(left.x - right.x) < 1e-6 && Math.abs(left.z - right.z) < 1e-6
}

/** Shared hover height so sparks, beams, and packets sit on one plane. */
function LANE_HEIGHT_Y(): number {
  return 0.15
}

/**
 * The lane's far endpoint = WHERE THE AGENT ACTUALLY STANDS. FID-2026-0829-001
 * (operator: "neon lines are not properly aligned with the actual agents —
 * size is off, location is not aligned"): lanes used to run console→home
 * pad (the 16-radius outer ring), but agents doing tool work stand AT their
 * station pedestal (the 9-radius hexagon) — a different angle and a shorter
 * distance, so the neon line ended past the agent in empty floor. While a
 * walker holds a station contract the lane now points at that station;
 * idle active walkers keep the console→pad link (their standing spot).
 */
function laneTarget(walker: WalkerState): PadPosition {
  if (walker.stationTarget !== null) {
    return stationPosition(stationIndex(walker.stationTarget))
  }
  return padPosition(walker.padIndex)
}
