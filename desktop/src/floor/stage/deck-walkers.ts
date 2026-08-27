/**
 * FID-2026-0822-012 asset pass — persistent 10-role robot cast.
 *
 * The full ECHO roster stands on the floor AT ALL TIMES (operator directive
 * 2026-08-24: "we need all of them visible, not just savant"): Savant at the
 * central console, the nine specialists on their home pads in a dim standby
 * glow. When the adapter reports an active walker for a role, that role's
 * figure brightens, plays its walk clip, and speed-limits over to the tool
 * pedestal — the old walker movement contract, now carried by real rigged
 * robots (see stage/deck-robots.ts). Dissolution walks the figure home and
 * dims it back to standby; nothing ever despawns.
 *
 * Movement stays speed-limited against the INJECTED clock delta
 * (deterministic under replay and tests); reduced motion freezes clips and
 * trails while state-truth positions still step. Figures materialize when
 * the async figure factory resolves — a missing/corrupt GLB falls back to a
 * solid minimal silhouette, never a wireframe (operator directive).
 */

import { Group } from 'three'

import { padPosition } from '../adapter/floor-adapter'
import { DECK_ROLE_IDS, ROLE_LABELS, roleAccent } from '../roles'
import { stationIndex, stationPosition } from '../stations'
import {
  ROBOT_TARGET_HEIGHT,
  buildFallbackFigure,
  createRobotFigure,
  lastTemplateOutcome,
  loadRobotTemplate,
} from './deck-robots'
import { createNameplate } from './nameplate'
import { TRAIL_SPACING_MS, TrailPool } from './trail-pool'

import type { RobotFigure } from './deck-robots'
import type { AnimationSyncOptions } from './motion'
import type { Nameplate } from './nameplate'
import type { FloorState, WalkerState } from '../adapter/floor-adapter'
import type { DeckCoreRoleId } from '../roles'
import type { Scene } from 'three'

/** Ground speed for pad<->station walks (world units per second). */
const WALK_SPEED_UNITS_PER_SEC = 3
/** Clock-delta clamp: one huge gap never teleports a figure across the floor. */
const MAX_SYNC_DELTA_MS = 1000
/** Savant stands taller at the console. */
const SAVANT_SCALE = 1.3

export type FigureFactory = (
  roleId: DeckCoreRoleId,
  accent: string,
  height: number,
) => Promise<RobotFigure | null>

export interface WalkerLayerOptions {
  /** DI seam: tests inject synchronous fake figures (never the network). */
  figureFactory?: FigureFactory
  /** Fired EXACTLY ONCE after every cast factory settles (real figure or
   * fallback). The reduced-motion runtime paints a single static frame at
   * mount — before any async figure exists — so without this repaint hook
   * the entire roster stays invisible for the whole session
   * (FID-2026-0824-032 root cause). */
  onCastSettled?: () => void
}

interface CastEntry {
  readonly roleId: DeckCoreRoleId
  readonly accent: string
  readonly homeX: number
  readonly homeZ: number
  readonly scale: number
  figure: RobotFigure | null
  nameplate: Nameplate | null
  lastNowMs: number | null
  lastTrailMs: number | null
  active: boolean
}

/** First ACTIVE walker whose cast role matches; Map order = spawn order. */
function activeWalkerFor(
  floor: FloorState,
  roleId: DeckCoreRoleId,
): WalkerState | null {
  for (const walker of floor.walkers.values()) {
    if (walker.roleId === roleId && walker.phase === 'active') return walker
  }
  return null
}

/** Step one axis toward target by at most maxStep (never overshoots). */
function advanceAxis(current: number, target: number, maxStep: number): number {
  const delta = target - current
  if (Math.abs(delta) <= maxStep) return target
  return current + Math.sign(delta) * maxStep
}

/** Production factory: the vendored robot, or the solid fallback silhouette. */
function defaultFigureFactory(
  roleId: DeckCoreRoleId,
  accent: string,
  height: number,
): Promise<RobotFigure | null> {
  return loadRobotTemplate().then((template) =>
    template === null
      ? buildFallbackFigure(accent)
      : createRobotFigure(template, accent, { height }),
  )
}

export class WalkerLayer {
  private readonly root = new Group()
  private readonly cast = new Map<DeckCoreRoleId, CastEntry>()
  private readonly trails: TrailPool
  private readonly figureFactory: FigureFactory
  private disposed = false

  constructor(scene: Scene, options: WalkerLayerOptions = {}) {
    // Markers live inside our own root so the layer's scene-child count is
    // exactly one (existing invariant pinned by test).
    this.trails = new TrailPool(this.root)
    this.figureFactory = options.figureFactory ?? defaultFigureFactory
    // Async-settle accounting: onCastSettled fires when the LAST factory
    // resolves or falls back — never twice, never zero times.
    let pending = DECK_ROLE_IDS.length
    for (let index = 0; index < DECK_ROLE_IDS.length; index += 1) {
      const roleId = DECK_ROLE_IDS[index]
      const isSavant = roleId === 'savant'
      const home = isSavant ? { x: 0, z: 0 } : padPosition(index - 1)
      const scale = isSavant ? SAVANT_SCALE : 1
      const entry: CastEntry = {
        roleId,
        accent: roleAccent(roleId),
        homeX: home.x,
        homeZ: home.z,
        scale,
        figure: null,
        nameplate: null,
        lastNowMs: null,
        lastTrailMs: null,
        active: false,
      }
      this.cast.set(roleId, entry)
      // Figures materialize when the async factory resolves; sync() skips
      // slots until then. A dispose before resolution drops the figure.
      // .catch mounts the fallback on ANY rejection — a throw in the real
      // GLB path (skeleton clone, mixer setup) must never silently empty a
      // cast slot (FID-2026-0824-030, Law 14).
      // Height normalization happens INSIDE the factory; role sizing
      // (Savant taller) is mountFigure's root-scale job. Passing the scaled
      // height here double-applied Savant's factor (2026-08-25 fix).
      void this.figureFactory(roleId, entry.accent, ROBOT_TARGET_HEIGHT)
        .then((figure) => {
          this.mountFigure(entry, figure)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          // eslint-disable-next-line no-console
          console.warn(
            `[deck] cast figure ${entry.roleId} fell back: ${message}`,
          )
          this.mountFigure(entry, null)
        })
        .finally(() => {
          pending -= 1
          if (pending === 0) options.onCastSettled?.()
        })
    }
    scene.add(this.root)
  }

  /** Mount one figure (+ nameplate) into the layer; null mounts the fallback. */
  private mountFigure(entry: CastEntry, figure: RobotFigure | null): void {
    if (this.disposed) {
      figure?.dispose()
      return
    }
    const settled = figure ?? buildFallbackFigure(entry.accent)
    settled.root.position.set(entry.homeX, 0, entry.homeZ)
    settled.root.scale.setScalar(entry.scale)
    entry.figure = settled
    const nameplate = createNameplate({
      title: ROLE_LABELS[entry.roleId],
      subtitle: entry.roleId,
      accent: entry.accent,
      worldWidth: 2.2,
    })
    // Chest-height proportional placement — the old HEIGHT+0.6 flew the plate
    // to the top of the mech when the cast went mech-scale (operator report
    // 2026-08-25 01:33); station plates sit at their own designed heights.
    nameplate.sprite.position.y = ROBOT_TARGET_HEIGHT * 0.4
    settled.root.add(nameplate.sprite)
    entry.nameplate = nameplate
    this.root.add(settled.root)
  }

  /** Cast mount + robot-template state for the activity overlay
   * (FID-2026-0824-030). The template outcome rides along so
   * lastTemplateOutcome has exactly one production consumer — this feed
   * (Verifier AUDIT Law-4 condition). */
  castTelemetry(): { mounted: number; total: number; template: string } {
    let mounted = 0
    for (const entry of this.cast.values()) {
      if (entry.figure !== null) mounted += 1
    }
    return { mounted, total: this.cast.size, template: lastTemplateOutcome() }
  }

  /**
   * Reconcile floor state onto the persistent cast. Each role figure walks
   * its station/pad contract when an active walker matches its role and dims
   * back to standby when none does; Savant brightens only while a session
   * is live but never leaves the console. Reduced motion freezes clips and
   * trails while state-truth positions still step.
   */
  sync(
    floor: FloorState,
    nowMs: number,
    options: AnimationSyncOptions = {},
  ): void {
    if (this.disposed) return
    const reduced = options.reduced === true
    for (const entry of this.cast.values()) {
      const figure = entry.figure
      if (figure === null) continue
      const dtMs =
        entry.lastNowMs === null
          ? 0
          : Math.min(MAX_SYNC_DELTA_MS, Math.max(0, nowMs - entry.lastNowMs))
      entry.lastNowMs = nowMs
      const walker =
        entry.roleId === 'savant' ? null : activeWalkerFor(floor, entry.roleId)
      const isActive =
        entry.roleId === 'savant' ? floor.savantPresent : walker !== null
      const desired =
        walker !== null && walker.stationTarget !== null
          ? stationPosition(stationIndex(walker.stationTarget))
          : { x: entry.homeX, z: entry.homeZ }
      const maxStep = (WALK_SPEED_UNITS_PER_SEC * dtMs) / 1000
      const nextX = advanceAxis(figure.root.position.x, desired.x, maxStep)
      const nextZ = advanceAxis(figure.root.position.z, desired.z, maxStep)
      const moving =
        Math.abs(nextX - figure.root.position.x) > 1e-9 ||
        Math.abs(nextZ - figure.root.position.z) > 1e-9
      figure.root.position.set(nextX, 0, nextZ)
      figure.setActive(isActive)
      entry.nameplate?.update(isActive)
      figure.update(dtMs, { moving, reduced })
      if (moving && !reduced) {
        if (
          entry.lastTrailMs === null ||
          nowMs - entry.lastTrailMs >= TRAIL_SPACING_MS
        ) {
          entry.lastTrailMs = nowMs
          this.trails.drop(entry.accent, nextX, nextZ, nowMs)
        }
      } else if (!moving) {
        entry.lastTrailMs = null
      }
    }
    this.trails.sync(nowMs)
  }

  /** Idempotent teardown — safe under strict-mode double-mount. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const entry of this.cast.values()) {
      entry.figure?.dispose()
      entry.nameplate?.dispose()
    }
    this.cast.clear()
    this.trails.dispose()
    this.root.removeFromParent()
  }
}
