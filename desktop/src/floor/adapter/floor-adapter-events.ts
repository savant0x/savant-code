// FID-2026-0819-005 Loop 237: the PrintModeEvent reducer, extracted verbatim
// from floor-adapter.ts (over the 300-line ceiling). floor-adapter.ts
// re-exports both entry points so every existing importer is unchanged;
// constants/types stay in floor-adapter.ts (live bindings resolve at call
// time, so the cycle is safe).

import { castAgent } from '../roles'
import { routeToolClass } from '../stations'
import {
  PAD_COUNT,
  PENDING_TOOLS_CAP,
  REASONING_GAP_MS,
  THINKER_BURST_CAP,
  type FloorState,
  type WalkerState,
} from './floor-adapter'

import type { StationId } from '../stations'
import type {
  PrintModeEvent,
  PrintModeToolResult,
} from '@savant-code/common/types/print-mode'

/**
 * G2 INTERIM rule: read the FSM phase from the transition_phase RESULT
 * payload (structured JSON `{ phase }`). Absent/unparseable renders
 * `'unknown'` — never a fallback scrape. Expires per G2 when the amendment
 * adds a dedicated phase event.
 */
function phaseFromResult(result: PrintModeToolResult): string {
  for (const part of result.output) {
    if (part.type !== 'json') continue
    const value: unknown = part.value
    if (
      typeof value === 'object' &&
      value !== null &&
      'phase' in value &&
      typeof (value as { phase: unknown }).phase === 'string'
    ) {
      const phase = (value as { phase: string }).phase
      if (phase.length > 0) return phase
    }
  }
  return 'unknown'
}

/** Pad indexes currently held by ACTIVE walkers (dissolved pads are free). */
function activeHeldPads(state: FloorState): Set<number> {
  const held = new Set<number>()
  for (const walker of state.walkers.values()) {
    if (walker.phase === 'active') held.add(walker.padIndex)
  }
  return held
}

/** Smallest pad index not held by an active walker; full ring wraps oldest. */
function nextFreePad(state: FloorState): number {
  const held = activeHeldPads(state)
  for (let index = 0; index < PAD_COUNT; index += 1) {
    if (!held.has(index)) return index
  }
  // Ring overflow: reuse the lowest held pad (bounded-degradation choice,
  // recorded as the v1 behavior for >PAD_COUNT concurrent subagents).
  let lowest = Number.POSITIVE_INFINITY
  for (const index of held) lowest = Math.min(lowest, index)
  return lowest === Number.POSITIVE_INFINITY ? 0 : lowest
}

/**
 * Fold one event into the floor state. Pure: unrelated events return the
 * SAME reference (cheap change detection downstream), never a clone.
 *
 * `nowMs` is the INJECTED adapter-arrival time (MQ-M) — required only for
 * reasoning_delta segmentation; other events ignore it entirely.
 */
export function applyFloorEvent(
  state: FloorState,
  event: PrintModeEvent,
  nowMs?: number,
): FloorState {
  if (event.type === 'reasoning_delta') {
    // Burst segmentation needs an arrival clock; without one the delta is
    // dropped rather than guessed at (determinism beats completeness).
    if (nowMs === undefined || !Number.isFinite(nowMs)) return state
    const last = state.reasoningClocks.get(event.agentId)
    const opensBurst = last === undefined || nowMs - last >= REASONING_GAP_MS
    const clocks = new Map(state.reasoningClocks)
    clocks.set(event.agentId, nowMs)
    if (!opensBurst) return { ...state, reasoningClocks: clocks }
    const nextSeq = (state.thinkerBursts.at(-1)?.seq ?? 0) + 1
    const bursts = [
      ...state.thinkerBursts,
      { seq: nextSeq, agentId: event.agentId },
    ]
    while (bursts.length > THINKER_BURST_CAP) bursts.shift()
    return { ...state, reasoningClocks: clocks, thinkerBursts: bursts }
  }

  if (event.type === 'start') {
    if (state.savantPresent) return state
    return { ...state, savantPresent: true }
  }

  // FID-2026-0828-002 (operator: chat idle = floor idle, 1:1 mirror):
  // `finish` closes the run — Savant dims (no longer present) and every
  // still-active subagent walker dissolves. Stale walkers from an earlier
  // batch must not keep the floor lit after the chat goes quiet.
  if (event.type === 'finish') {
    if (!state.savantPresent && state.walkers.size === 0) return state
    const walkers = new Map()
    for (const [agentId, walker] of state.walkers) {
      if (walker.phase === 'active') {
        walkers.set(agentId, {
          ...walker,
          phase: 'dissolved',
          stationTarget: null,
        })
      } else {
        walkers.set(agentId, walker)
      }
    }
    return { ...state, savantPresent: false, walkers }
  }

  if (event.type === 'subagent_start') {
    const existing = state.walkers.get(event.agentId)
    if (existing !== undefined && existing.phase === 'active') return state
    const walker: WalkerState = {
      agentId: event.agentId,
      roleId: castAgent(event.agentType, event.displayName),
      displayName: event.displayName,
      // A respawning agent keeps its old pad ONLY while no active walker
      // holds it (audit finding: sticky pads could stack two figures).
      padIndex:
        existing !== undefined && !activeHeldPads(state).has(existing.padIndex)
          ? existing.padIndex
          : nextFreePad(state),
      stationTarget: existing?.stationTarget ?? null,
      phase: 'active',
    }
    const walkers = new Map(state.walkers)
    walkers.set(event.agentId, walker)
    return { ...state, walkers }
  }

  if (event.type === 'subagent_finish') {
    const existing = state.walkers.get(event.agentId)
    if (existing === undefined || existing.phase === 'dissolved') return state
    const walkers = new Map(state.walkers)
    walkers.set(event.agentId, { ...existing, phase: 'dissolved' })
    return { ...state, walkers }
  }

  if (event.type === 'tool_call') {
    // FID-2026-0828-002 D: the orchestrator's own tool calls carry NO
    // agentId. The old rule admitted only `transition_phase` (aura-only)
    // and DROPPED every other unattributed call — so an orchestrator-only
    // run (the default HYBRID flow) produced zero floor activity and the
    // deck read as dead while chat visibly worked. Fix: unattributed calls
    // now route to the ORCHESTRATOR (Savant, always present at the
    // console) and drive station visits like an attributed call. The G2
    // aura flag still applies for transition_phase phase pairing.
    const isAuraCall = event.toolName === 'transition_phase'
    if (state.pendingTools.has(event.toolCallId)) return state
    // FID-2026-0828-002 D (REVISED): the live orchestrator's own tool calls
    // carry agentId like 'orchestrator-1' — NOT undefined — and the
    // orchestrator never emits a subagent_start, so its pad walker record
    // is absent. The old rule DROPPED every such call (its owning walker
    // wasn't active), which is exactly why the deck stayed dead: every
    // batch showed `tools=0 in-flight | walkers=0` even while chat visibly
    // used tools. Fix: any tool_call whose owning active walker isn't found
    // (incl. the orchestrator) routes to SAVANT at the console, so tool
    // traffic always drives a station visit.
    const callerWalker =
      event.agentId !== undefined ? state.walkers.get(event.agentId) : undefined
    const hasActiveWalker =
      callerWalker !== undefined && callerWalker.phase === 'active'
    const agentId = hasActiveWalker ? (event.agentId as string) : 'savant'
    const station = routeToolClass(event.toolName)
    const pendingTools = new Map(state.pendingTools)
    // Bounded attribution map: FIFO eviction past the cap (FID spec).
    if (pendingTools.size >= PENDING_TOOLS_CAP) {
      const oldest = pendingTools.keys().next().value
      if (oldest !== undefined) pendingTools.delete(oldest)
    }
    pendingTools.set(event.toolCallId, {
      agentId,
      station,
      aura: isAuraCall,
      toolName: event.toolName,
    })
    const walkers = new Map(state.walkers)
    const targetWalker = hasActiveWalker
      ? callerWalker
      : state.walkers.get('savant')
    if (targetWalker !== undefined && targetWalker.phase === 'active') {
      walkers.set(agentId, { ...targetWalker, stationTarget: station })
    } else {
      // Materialize the Savant (orchestrator) walker record on first use.
      // Savant is a persistent cast member who never receives a
      // `subagent_start`; without this record the walker layer (which reads
      // floor.walkers) would never see the orchestrator's station target.
      walkers.set('savant', {
        agentId: 'savant',
        roleId: 'savant',
        displayName: 'Savant',
        padIndex: 0,
        phase: 'active',
        stationTarget: station,
      })
    }
    return { ...state, pendingTools, walkers }
  }

  if (event.type === 'tool_result') {
    const pending = state.pendingTools.get(event.toolCallId)
    if (pending === undefined) return state
    const pendingTools = new Map(state.pendingTools)
    pendingTools.delete(event.toolCallId)
    // Walk home only when NO other call of this agent remains in flight.
    // Concurrent calls resolve to the OLDEST in-flight station (Map insertion
    // order) — documented v1 choice pinned by the multi-call targeting test.
    let remaining: StationId | null = null
    const agentId = pending.agentId
    for (const flight of pendingTools.values()) {
      if (flight.agentId === agentId) {
        remaining = flight.station
        break
      }
    }
    const walker = agentId !== null ? state.walkers.get(agentId) : undefined
    let fsmPhase = state.fsmPhase
    if (pending.aura) fsmPhase = phaseFromResult(event)
    const pulseSeq = state.pulseSeq + 1
    const base: Partial<FloorState> & Pick<FloorState, 'pendingTools'> = {
      pendingTools,
      fsmPhase,
      pulseSeq,
      lastPulse: { seq: pulseSeq, agentId },
    }
    if (
      walker === undefined ||
      walker.phase !== 'active' ||
      walker.stationTarget === remaining
    ) {
      return { ...state, ...base }
    }
    const walkers = new Map(state.walkers)
    if (agentId !== null) {
      walkers.set(agentId, { ...walker, stationTarget: remaining })
    }
    return { ...state, ...base, walkers }
  }

  return state
}

/** Fold an ordered event sequence (replay fixture or live batch). */
export function applyFloorEvents(
  state: FloorState,
  events: readonly PrintModeEvent[],
  clock?: (index: number) => number,
): FloorState {
  let current = state
  for (let index = 0; index < events.length; index += 1) {
    current = applyFloorEvent(current, events[index], clock?.(index))
  }
  return current
}
