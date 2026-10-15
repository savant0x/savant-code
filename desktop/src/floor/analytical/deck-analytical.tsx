/**
 * FID-2026-0822-012 P5 — analytical command-deck fallback.
 *
 * The Linux/WebGL-unavailable tier: the SAME pure FloorState that drives the
 * Three.js stage renders as a flat SVG plan — console, spawn pads, stations,
 * walker dots, aura ring, lanes. Zero three.js imports; every visual derives
 * from adapter data and contract tokens exactly like the WebGL path, so the
 * two views can never disagree about state (one truth, two projections).
 *
 * v1 anchors walkers at their home pads and packets are not rendered — the
 * live event driver (post-FID-008) feeds this component the same way it will
 * feed the stage; richer motion lands with it (recorded boundary).
 */

import { padPosition, PAD_COUNT } from '../adapter/floor-adapter'
import { DECK_TOKENS } from '../deck-tokens.generated'
import { roleAccent } from '../roles'
import {
  phaseAccent,
  STATION_ACCENTS,
  STATION_COUNT,
  stationIndex,
  stationPosition,
} from '../stations'

import type { FloorState } from '../adapter/floor-adapter'
import type { JSX } from 'react'

/** World units -> viewBox pixels (pad ring 16 => radius 160 inside 420). */
const SCALE = 10
const CENTER = 210
const AURA_PX = 26

function px(value: number): number {
  return CENTER + value * SCALE
}

export function AnalyticalFloor({
  floor,
}: {
  readonly floor: FloorState
}): JSX.Element {
  const activeWalkers = [...floor.walkers.values()].filter(
    (walker) => walker.phase === 'active',
  )
  return (
    <svg
      viewBox="0 0 420 420"
      className="deck-analytical"
      role="img"
      aria-label="Command deck floor (analytical view)"
    >
      <rect
        x={0}
        y={0}
        width={420}
        height={420}
        fill={DECK_TOKENS.background}
      />
      {/* FSM aura ring under everything else once a phase has paired. */}
      {floor.fsmPhase !== null ? (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={AURA_PX}
          fill="none"
          stroke={phaseAccent(floor.fsmPhase)}
          strokeWidth={2}
        />
      ) : null}
      {/* Packet-lane beams: console to where each active walker stands.
       * FID-2026-0829-001 (parity with StateFxLayer): an agent working a
       * station contract stands AT its pedestal, so the lane ends at the
       * station; idle active walkers keep the console→home-pad link. */}
      {activeWalkers.map((walker) => {
        const target =
          walker.stationTarget !== null
            ? stationPosition(stationIndex(walker.stationTarget))
            : padPosition(walker.padIndex)
        return (
          <line
            key={`lane-${walker.agentId}`}
            x1={CENTER}
            y1={CENTER}
            x2={px(target.x)}
            y2={px(target.z)}
            stroke={DECK_TOKENS.border}
            strokeWidth={1}
          />
        )
      })}
      {/* Six tool-class stations as squares on the hexagon. */}
      {Array.from({ length: STATION_COUNT }, (_, index) => {
        const pos = stationPosition(index)
        return (
          <rect
            key={`station-${index}`}
            x={px(pos.x) - 9}
            y={px(pos.z) - 9}
            width={18}
            height={18}
            fill="none"
            stroke={STATION_ACCENTS[index] ?? DECK_TOKENS.primary}
            strokeWidth={1.5}
          />
        )
      })}
      {/* Twelve spawn pads as dim circles on the outer ring. */}
      {Array.from({ length: PAD_COUNT }, (_, index) => {
        const pos = padPosition(index)
        return (
          <circle
            key={`pad-${index}`}
            cx={px(pos.x)}
            cy={px(pos.z)}
            r={4}
            fill="none"
            stroke={DECK_TOKENS.border}
            strokeWidth={1}
          />
        )
      })}
      {/* The Savant console at the center. */}
      {floor.savantPresent ? (
        <circle cx={CENTER} cy={CENTER} r={10} fill={DECK_TOKENS.primary} />
      ) : null}
      {/* Walker dots pinned to their pads, tinted by cast-role accent. */}
      {activeWalkers.map((walker) => {
        const pad = padPosition(walker.padIndex)
        return (
          <circle
            key={walker.agentId}
            cx={px(pad.x)}
            cy={px(pad.z)}
            r={6}
            fill={roleAccent(walker.roleId)}
          />
        )
      })}
    </svg>
  )
}
