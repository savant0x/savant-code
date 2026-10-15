/**
 * FID-2026-0831-001 P1 — office floor-plan geometry (pure, zero three.js).
 *
 * The cyberpunk office the characters inhabit: a central command console,
 * six tool-class desks on the existing station hexagon, and personal desks
 * on the existing pad ring. Every position derives from the SHARED geometry
 * (`stationPosition`, `padPosition`) so the R3F scene, the analytical SVG
 * fallback, and all existing tests can never disagree about where anything
 * stands (one truth, two projections — audit rule from the old deck).
 *
 * Zero three.js imports: this is data, not rendering.
 */

import { padPosition } from '../adapter/floor-adapter'
import {
  STATION_IDS,
  STATION_LABELS,
  STATION_ACCENTS,
  stationIndex,
  stationPosition,
} from '../stations'

import type { PadPosition } from '../adapter/floor-adapter'
import type { StationId } from '../stations'

export interface DeskSpot {
  readonly id: StationId
  readonly label: string
  readonly accent: string
  readonly position: PadPosition
}

/** The six tool-class desks on the existing station hexagon. */
export const TOOL_DESKS: readonly DeskSpot[] = STATION_IDS.map((id, index) => ({
  id,
  label: STATION_LABELS[id],
  accent: STATION_ACCENTS[index] ?? '#5fd8d8',
  position: stationPosition(index),
}))

/** Personal desks on the existing pad ring (one per cast pad slot). */
export const HOME_DESK_COUNT = 9

export function homeDeskPosition(padIndex: number): PadPosition {
  return padPosition(padIndex)
}

/** Where a walker stands while working a tool-class contract. */
export function deskPosition(stationId: StationId): PadPosition {
  return stationPosition(stationIndex(stationId))
}

/** Where a walker stands when idle: its personal desk on the pad ring. */
export function homePosition(padIndex: number): PadPosition {
  return homeDeskPosition(padIndex)
}

/** Where a walker SEATS at a desk. Desks face the console (their local +Z
 * points toward the origin), so the operator's chair sits on the CONSOLE
 * side of the desk — radially INWARD from the desk's center. Standing there,
 * the figure faces the desk's monitor on the far edge (operator: "agents are
 * on the opposite of the computer screens, their backs are to the screens"
 * — the old standSpot pushed them OUTWARD, behind the monitor, facing away).
 * The seat is a fixed distance inside the desk so the figure sits at the
 * workstation, never clipping through the desktop. */
export function standSpot(desk: PadPosition): PadPosition {
  const len = Math.hypot(desk.x, desk.z)
  if (len < 1e-6) return desk
  // Inward (toward the console) = subtract the radial unit vector. Seat sits
  // just clear of the desk front so the robot reads as working at it.
  const seatOffset = 1.7
  return {
    x: desk.x - (desk.x / len) * seatOffset,
    z: desk.z - (desk.z / len) * seatOffset,
  }
}

/** The point an idle agent at a desk should FACE: the desk's monitor edge
 * (the far, outward side). Returns a world position the heading should aim
 * at so the figure looks at its screen, not away from it. */
export function deskFaceTarget(desk: PadPosition): PadPosition {
  const len = Math.hypot(desk.x, desk.z)
  if (len < 1e-6) return desk
  return {
    x: desk.x + (desk.x / len) * 0.9,
    z: desk.z + (desk.z / len) * 0.9,
  }
}

/** FID-2026-0831-002 P6c/P7: Savant's own spot — the EXACT center of the
 * floor on the holo pedestal (operator: "place savant in the center with a
 * glowing stroke around it"). Never a pad-ring slot. */
export const CONSOLE_SPOT: PadPosition = { x: 0, z: 0 }

/** Where the orchestrator (Savant) stands when not visiting a station. */
export function savantSpot(): PadPosition {
  return CONSOLE_SPOT
}

/** Where newly appeared walkers materialize before walking to their desk
 *  (P6c: the operator asked for visible movement — spawning AT the desk
 *  reads as static; spawning at the console edge reads as arrival).
 *
 *  P18 (operator: agents "get stuck on the forge table" / missing
 *  boundaries): the spawn point MUST sit outside every obstacle's route
 *  skip-window. The old (0, 6.5) landed inside the File Forge desk's
 *  clearance window (desk at (0, 9), clearance 3.5 + SKIP_WINDOW 0.9 ≈ 4.4
 *  > 2.5), so `routeAround` treated the desk as "the agent is already
 *  there" and SKIPPED it — fresh walkers clipped straight through the desk
 *  on their way out. (0, 4.2) is outside the forge window (2.5 < 3.5) and
 *  outside the console obstacle's own skip window (4.2 > 2.2 + 0.9 = 3.1). */
export const SPAWN_POINT: PadPosition = { x: 0, z: 4.2 }

// ─── FID-2026-0901-003: break-area furniture spots ─────────────────────────
// A corner break area the idle cast can visit (coffee machine, water cooler,
// fridge, couch, whiteboard). Positions hug the +X/+Z corner, clear of the
// pad ring (radius 16 desks) and the station hexagon.

export interface BreakSpot {
  readonly kind: 'coffee' | 'water' | 'couch' | 'whiteboard'
  readonly position: PadPosition
}

/** The furniture placement — single truth for both rendering and walking. */
export const BREAK_SPOTS: readonly BreakSpot[] = [
  { kind: 'coffee', position: { x: 14.5, z: 14.5 } },
  { kind: 'water', position: { x: 16.2, z: 11.5 } },
  { kind: 'couch', position: { x: 11, z: 15.5 } },
  { kind: 'whiteboard', position: { x: 15.5, z: 6 } },
]

/** Where an agent STANDS to use a break facility (just in front of it). */
export function breakUseSpot(kind: BreakSpot['kind']): PadPosition {
  const spot = BREAK_SPOTS.find((entry) => entry.kind === kind)
  if (spot === undefined) return { x: 12, z: 12 }
  // Stand radially inward of the furniture (toward the room center).
  const len = Math.hypot(spot.position.x, spot.position.z)
  if (len < 1e-6) return spot.position
  const useOffset = 1.4
  return {
    x: spot.position.x - (spot.position.x / len) * useOffset,
    z: spot.position.z - (spot.position.z / len) * useOffset,
  }
}

// ─── FID-2026-0901-003 P9: walk-obstacle footprints ─────────────────────────
// P9 (operator: "agents walking through desks, not around them"): circular
// no-walk footprints for everything an agent can collide with. Radii are
// generous half-diagonals of each footprint so the boxy geometry never clips.
// Single truth shared by the walk router and tests — the scene imports these,
// it never re-derives them.

export interface WalkObstacleSpot {
  readonly x: number
  readonly z: number
  readonly r: number
}

/** The central holo pedestal + emblem exclusion zone (Savant stands here). */
export const CONSOLE_OBSTACLE: WalkObstacleSpot = { x: 0, z: 0, r: 2.2 }

/** A tool desk's footprint (deskW 4.8 × deskD 2.6 → half-diagonal ~2.7). */
function toolDeskObstacle(desk: PadPosition): WalkObstacleSpot {
  return { x: desk.x, z: desk.z, r: 2.7 }
}

/** A home desk's footprint (deskW 4.2 × deskD 2.4 → half-diagonal ~2.4). */
function homeDeskObstacle(desk: PadPosition): WalkObstacleSpot {
  return { x: desk.x, z: desk.z, r: 2.4 }
}

/** Every static obstacle on the floor, derived from the furniture layout. */
export const WALK_OBSTACLES: readonly WalkObstacleSpot[] = [
  CONSOLE_OBSTACLE,
  ...TOOL_DESKS.map((desk) => toolDeskObstacle(desk.position)),
  ...Array.from({ length: HOME_DESK_COUNT }, (_, index) =>
    homeDeskObstacle(homeDeskPosition(index)),
  ),
  // Break-area furniture (matches the placements in office-scene.tsx).
  { x: 14.5, z: 14.5, r: 1.1 }, // coffee machine + counter
  { x: 16.2, z: 11.5, r: 0.7 }, // water cooler
  { x: 16.6, z: 15.8, r: 0.9 }, // fridge
  { x: 11, z: 15.5, r: 1.7 }, // couch
  { x: 15.5, z: 6, r: 1.5 }, // whiteboard
  // Server racks / holo columns / cargo stacks (scene placements).
  { x: -19.9, z: -10, r: 0.8 },
  { x: -19.9, z: -8.6, r: 0.8 },
  { x: 19.9, z: 12, r: 0.8 },
  { x: 7.5, z: -12.5, r: 0.7 },
  { x: -7.5, z: -12.5, r: 0.7 },
  { x: 13.5, z: -13, r: 0.9 },
  { x: -13.5, z: 13, r: 0.9 },
]

/** Accent for a tool-class desk (single truth, shared with the SVG path). */
export function deskAccent(stationId: StationId): string {
  const index = stationIndex(stationId)
  return TOOL_DESKS[index]?.accent ?? '#5fd8d8'
}

/** Label for a tool-class desk (single truth with the station chips). */
export function deskLabel(stationId: StationId): string {
  return STATION_LABELS[stationId]
}
