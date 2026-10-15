/**
 * FID-2026-0822-012 P2+P3+P4+P5 — pure floor adapter: PrintModeEvent deltas =>
 * walker state. Zero three.js imports, zero DOM, no session-scoped state
 * sources (Amendment Gate G4): every input is a typed PrintModeEvent and every output
 * is plain data, so the reducer is unit-testable against the Tier-1 replay
 * fixtures exactly as it will consume the live gateway stream post-FID-008.
 *
 * P2 scope: Savant presence at the central console (`start`) and walker
 * lifecycles from `subagent_start` / `subagent_finish`; dissolution renders
 * neutral by design — the finish event carries no outcome field (Loop 1
 * disposition). P3 scope: walker station targeting from tool traffic —
 * `tool_call` (joined by `agentId`) sends the owning walker to its tool-
 * class pedestal; the matching `tool_result` (joined by `toolCallId`) walks
 * it home once no call of that agent remains in flight. P4 scope: FSM auras
 * via the INTERIM pairing rule (G2) — a `transition_phase` tool_call paired
 * with its tool_result by toolCallId yields the phase from the structured
 * result payload, absent/unparseable rendering `unknown`; the rule EXPIRES
 * when the amendment adds a dedicated phase event. Result pulses carry a
 * monotonic seq + attribution for spark bursts; the attribution map is
 * bounded (PENDING_TOOLS_CAP, FIFO eviction). P5 scope: thinker glyph
 * bursts — `reasoning_delta` events segmented deterministically by an
 * INJECTED arrival clock (MQ-M: never wall timestamps); a gap of
 * REASONING_GAP_MS or more opens a new burst; the ring keeps the last
 * THINKER_BURST_CAP bursts.
 */

import type { DeckRoleId } from '../roles'
import type { StationId } from '../stations'

/** Spawn pads form a deterministic ring around the central console.
 * FID-2026-0828-002: 12 pads on a 16-radius ring left a visible gap arc
 * ("moon shape") because the 10-role cast only occupies 9 slots — the
 * empty 12th sector read as a missing crescent. PAD_COUNT now matches the
 * cast: 9 evenly spaced pads form a FULL circle around Savant. */
export const PAD_COUNT = 9
/** Pad-ring radius in world units (camera default distance is 34). */
export const PAD_RING_RADIUS = 16
/** Attribution-map bound (FID spec: cap 512 FIFO). */
export const PENDING_TOOLS_CAP = 512
/** Idle-gap segmentation for reasoning bursts (FID spec: >=1500ms). */
export const REASONING_GAP_MS = 1500
/** Glyph ring capacity (FID spec: show the last 8 bursts). */
export const THINKER_BURST_CAP = 8

export type WalkerPhase = 'active' | 'dissolved'

export interface WalkerState {
  readonly agentId: string
  readonly roleId: DeckRoleId
  readonly displayName: string
  readonly padIndex: number
  readonly phase: WalkerPhase
  /** Tool-class pedestal the walker is currently visiting (null = at pad). */
  readonly stationTarget: StationId | null
}

/** One in-flight tool call, keyed by toolCallId in FloorState. */
export interface ToolInFlight {
  /** Owning walker id — null for AURA-ONLY orchestrator entries (audit fix:
   * orchestrator transition_phase carries no agentId and is the primary G2
   * input; such calls pair phases but never target stations). */
  readonly agentId: string | null
  readonly station: StationId
  /** True when this call is a `transition_phase` (G2 aura pairing input). */
  readonly aura: boolean
  /** The routed tool's own name (activity overlay: "what is it running"). */
  readonly toolName: string
}

/** Attributed result pulse consumed by the spark-burst renderer (P4). */
export interface ResultPulse {
  readonly seq: number
  /** Owning walker id, or null => the burst lands on the console (Core). */
  readonly agentId: string | null
}

/** One segmented reasoning burst for the thinker glyph ring (P5). */
export interface ThinkerBurst {
  readonly seq: number
  readonly agentId: string
}

export interface FloorState {
  readonly savantPresent: boolean
  readonly walkers: ReadonlyMap<string, WalkerState>
  readonly pendingTools: ReadonlyMap<string, ToolInFlight>
  /** Latest G2-paired FSM phase; null until first transition_phase resolves. */
  readonly fsmPhase: string | null
  /** Monotonic pulse counter — every resolved tool_result advances it. */
  readonly pulseSeq: number
  readonly lastPulse: ResultPulse | null
  /** Last THINKER_BURST_CAP reasoning bursts, oldest first (glyph ring). */
  readonly thinkerBursts: readonly ThinkerBurst[]
  /** Adapter bookkeeping: agentId -> last reasoning_delta arrival (ms).
   * Injected-clock values only — never wall timestamps (MQ-M). */
  readonly reasoningClocks: ReadonlyMap<string, number>
}

export interface PadPosition {
  readonly x: number
  readonly z: number
}

/** Deterministic pad geometry: evenly spaced ring around the console. */
export function padPosition(padIndex: number): PadPosition {
  const angle = ((padIndex % PAD_COUNT) / PAD_COUNT) * Math.PI * 2
  return {
    x: Math.sin(angle) * PAD_RING_RADIUS,
    z: Math.cos(angle) * PAD_RING_RADIUS,
  }
}

export function createFloorState(): FloorState {
  return {
    savantPresent: false,
    walkers: new Map(),
    pendingTools: new Map(),
    fsmPhase: null,
    pulseSeq: 0,
    lastPulse: null,
    thinkerBursts: [],
    reasoningClocks: new Map(),
  }
}

// FID-2026-0819-005 Loop 237: the event reducer lives in
// `floor-adapter-events.ts`; re-exported here so every importer is unchanged.
export { applyFloorEvent, applyFloorEvents } from './floor-adapter-events'
