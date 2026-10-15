// FID-2026-0819-005 Loop 232: lane/packet geometry, extracted verbatim from
// deck-state-fx.ts (over the 300-line ceiling). StateFxLayer wires these via
// the Lane record; behavior contract unchanged (FID-2026-0828-002 D-fix and
// FID-2026-0829-001 lane-targeting rules live here).

import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
} from 'three'

import {
  padPosition,
  type PadPosition,
  type WalkerState,
} from '../adapter/floor-adapter'
import { DECK_TOKENS } from '../deck-tokens.generated'
import { stationIndex, stationPosition } from '../stations'

import type { Mesh as ThreeMesh } from 'three'

/**
 * World position of a walker in deck units (surfaced by the runtime for
 * lane targeting; consumed by StateFxLayer.sync's optional positions map).
 */
export interface WalkerWorldPosition {
  readonly agentId: string
  readonly x: number
  readonly z: number
}

export function disposeMesh(mesh: ThreeMesh): void {
  mesh.geometry.dispose()
  ;(mesh.material as MeshBasicMaterial).dispose()
}

/** Shared hover height so sparks, beams, and packets sit on one plane. */
export function LANE_HEIGHT_Y(): number {
  return 0.15
}

export interface Lane {
  readonly packet: Mesh
  beam: Group
  target: PadPosition
}

export function samePosition(left: PadPosition, right: PadPosition): boolean {
  return Math.abs(left.x - right.x) < 1e-6 && Math.abs(left.z - right.z) < 1e-6
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
export function laneTarget(walker: WalkerState): PadPosition {
  if (walker.stationTarget !== null) {
    return stationPosition(stationIndex(walker.stationTarget))
  }
  return padPosition(walker.padIndex)
}

export function buildLane(target: PadPosition): Lane {
  const beam = buildBeam(target)
  const packet = new Mesh(
    new OctahedronGeometry(0.22),
    new MeshBasicMaterial({ color: new Color(DECK_TOKENS.inlineCodeFg) }),
  )
  return { beam, packet, target }
}

export function buildBeam(target: PadPosition): Group {
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
