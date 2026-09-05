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
import { DECK_ROLE_IDS, roleAccent } from '../roles'
import { stationIndex, stationPosition } from '../stations'
import { ROBOT_TARGET_HEIGHT, lastTemplateOutcome } from './deck-robots'
import {
  defaultFigureFactory,
  faceTowards,
  mountFigure,
  type CastEntry,
} from './deck-walkers-mount'
import { TRAIL_SPACING_MS, TrailPool } from './trail-pool'

import type { RobotFigure } from './deck-robots'
import type { AnimationSyncOptions } from './motion'
import type { FloorState, WalkerState } from '../adapter/floor-adapter'
import type { DeckCoreRoleId } from '../roles'
import type { Scene } from 'three'

/** Ground speed for pad<->station walks (world units per second).
 * FID-2026-0829-001 L3: 3 → 8 u/s — crosses a pad spacing (~8.3 units)
 * in ~1s so the movement is unmistakable at camera distance 22. */
const WALK_SPEED_UNITS_PER_SEC = 8.0
/** Clock-delta clamp: one huge gap never teleports a figure across the floor. */
const MAX_SYNC_DELTA_MS = 1000
/** Savant stands taller at the console. */
const SAVANT_SCALE = 1.3
/**
 * FID-2026-0828-002 coherent-world rescale: the mount scale is 1× — the
 * 6-unit normalized height IS the final body height. The earlier 2.5×
 * multiplier (over a 25-unit normalization) produced ~62-unit giants on a
 * floor designed for a ~5-unit cast: pads ~8.3 units apart meant bodies
 * overlapping and "everything stacked at one x/y point." The bigger-on-
 * screen read now comes from the truthful 6-unit height plus the camera
 * default (22), not a scale multiplier.
 */
const CAST_SCALE_FACTOR = 1

/**
 * FID-2026-0828-002 E (REVOKED by operator review): idle-cast wander made
 * the deck a screensaver — "if the chat is idle, the robots should not be
 * walking in circles." The deck is a 1:1 mirror of chat activity: cast
 * members stand at their pads while idle (dimmed); they move ONLY when the
 * adapter reports a live station contract. The wander machinery (waypoints,
 * dwell timing, golden-angle layout) is fully removed.
 */

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
      const scale = (isSavant ? SAVANT_SCALE : 1) * CAST_SCALE_FACTOR
      const entry: CastEntry = {
        roleId,
        roleIndex: index,
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
          console.error(
            `[deck] cast figure ${entry.roleId} factory failed: ${message}`,
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
    mountFigure(entry, figure, {
      isDisposed: () => this.disposed,
      root: this.root,
    })
  }

  /** Current visual ground anchor of a mounted role figure. */
  figurePosition(roleId: DeckCoreRoleId): { x: number; z: number } | null {
    const entry = this.cast.get(roleId)
    if (entry?.figure === null || entry?.figure === undefined) return null
    return {
      x: entry.figure.root.position.x + entry.figure.visualGroundOffset.x,
      z: entry.figure.root.position.z + entry.figure.visualGroundOffset.z,
    }
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
      // FID-2026-0828-002 D: Savant now honors orchestrator station targets.
      // The adapter routes unattributed (orchestrator) tool calls to agentId
      // 'savant'; previously the walker layer hard-pinned Savant to the
      // console, so an orchestrator-only run produced zero floor motion.
      // Savant keeps the console as HOME — with no in-flight call he returns
      // there — and departs to a pedestal exactly like a specialist while
      // one is in flight.
      const savantWalker = floor.walkers.get('savant')
      const walker =
        entry.roleId === 'savant'
          ? savantWalker !== undefined && savantWalker.phase === 'active'
            ? savantWalker
            : null
          : activeWalkerFor(floor, entry.roleId)
      const isActive =
        entry.roleId === 'savant'
          ? floor.savantPresent || savantWalker !== undefined
          : walker !== null
      // FID-2026-0828-002 E REVOKED: the ONLY movement driver is a station
      // contract from live chat events. Idle = home pad, dimmed (1:1 chat
      // mirror; the wander screensaver is retired).
      let desiredX = entry.homeX
      let desiredZ = entry.homeZ
      let speed = WALK_SPEED_UNITS_PER_SEC
      const onContract = walker !== null && walker.stationTarget !== null
      if (onContract) {
        const station = stationPosition(stationIndex(walker.stationTarget))
        desiredX = station.x
        desiredZ = station.z
      }
      const maxStep = (speed * dtMs) / 1000
      const nextX = advanceAxis(figure.root.position.x, desiredX, maxStep)
      const nextZ = advanceAxis(figure.root.position.z, desiredZ, maxStep)
      const moving =
        Math.abs(nextX - figure.root.position.x) > 1e-9 ||
        Math.abs(nextZ - figure.root.position.z) > 1e-9
      figure.root.position.set(nextX, 0, nextZ)
      // Operator: subagents always face Savant at the center — both on
      // their pads and while walking a contract (heading tracks motion).
      faceTowards(
        figure.root,
        nextX,
        nextZ,
        onContract ? desiredX : 0,
        onContract ? desiredZ : 0,
      )
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
