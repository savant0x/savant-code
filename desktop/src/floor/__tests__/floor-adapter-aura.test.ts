import { describe, expect, test } from 'bun:test'

import {
  PENDING_TOOLS_CAP,
  applyFloorEvent,
  applyFloorEvents,
  createFloorState,
} from '../adapter/floor-adapter'

describe('floor adapter — walker-lifecycle fixture (FID-2026-0822-012 P2)', () => {
  test('orchestrator transition_phase pairs without an agentId', () => {
    // Audit regression: the walker-only guard used to drop the PRIMARY G2
    // input — orchestrator phase transitions carry no agentId at all.
    const called = applyFloorEvent(createFloorState(), {
      type: 'tool_call',
      toolCallId: 'tc-orch',
      toolName: 'transition_phase',
      input: { phase: 'green' },
    })
    expect(called.fsmPhase).toBeNull()
    const resolved = applyFloorEvent(called, {
      type: 'tool_result',
      toolCallId: 'tc-orch',
      toolName: 'transition_phase',
      output: [{ type: 'json', value: { phase: 'green' } }],
    })
    expect(resolved.fsmPhase).toBe('green')
    // FID-2026-0828-002 D: the aura call now routes to the orchestrator
    // walker record (agentId 'savant') instead of a null-attributed pulse —
    // the pulse lands on Savant at the console.
    expect(resolved.lastPulse?.agentId).toBe('savant')
  })

  test('G2 aura pairing: transition_phase RESULT yields the FSM phase', () => {
    const spawned = applyFloorEvent(createFloorState(), {
      type: 'subagent_start',
      agentId: 'a',
      agentType: 'scout',
      displayName: 'Scout',
      onlyChild: false,
    })
    const called = applyFloorEvent(spawned, {
      type: 'tool_call',
      toolCallId: 'tc-p1',
      toolName: 'transition_phase',
      input: { phase: 'audit', reason: 'GREEN complete' },
      agentId: 'a',
    })
    // The CALL alone pairs nothing — the phase comes from the RESULT payload.
    expect(called.fsmPhase).toBeNull()
    const resolved = applyFloorEvent(called, {
      type: 'tool_result',
      toolCallId: 'tc-p1',
      toolName: 'transition_phase',
      output: [{ type: 'json', value: { phase: 'audit', message: 'ok' } }],
    })
    expect(resolved.fsmPhase).toBe('audit')
    expect(resolved.lastPulse?.seq).toBe(1)
    expect(resolved.lastPulse?.agentId).toBe('a')
  })

  test('absent/unparseable phase renders unknown per G2 — never a scrape', () => {
    const base = applyFloorEvents(createFloorState(), [
      {
        type: 'subagent_start',
        agentId: 'a',
        agentType: 'scout',
        displayName: 'Scout',
        onlyChild: false,
      },
      {
        type: 'tool_call',
        toolCallId: 'tc-p2',
        toolName: 'transition_phase',
        input: {},
        agentId: 'a',
      },
    ])
    // Empty output → unknown.
    const empty = applyFloorEvent(base, {
      type: 'tool_result',
      toolCallId: 'tc-p2',
      toolName: 'transition_phase',
      output: [],
    })
    expect(empty.fsmPhase).toBe('unknown')
    // JSON without a usable string phase → unknown.
    const second = applyFloorEvent(empty, {
      type: 'tool_call',
      toolCallId: 'tc-p3',
      toolName: 'transition_phase',
      input: {},
      agentId: 'a',
    })
    const junk = applyFloorEvent(second, {
      type: 'tool_result',
      toolCallId: 'tc-p3',
      toolName: 'transition_phase',
      output: [{ type: 'json', value: { phase: 42 } }],
    })
    expect(junk.fsmPhase).toBe('unknown')
  })

  test('non-aura results bump pulses without touching the phase', () => {
    let state = applyFloorEvents(createFloorState(), [
      {
        type: 'subagent_start',
        agentId: 'a',
        agentType: 'scout',
        displayName: 'Scout',
        onlyChild: false,
      },
      {
        type: 'tool_call',
        toolCallId: 'tc-f1',
        toolName: 'write_file',
        input: {},
        agentId: 'a',
      },
    ])
    expect(state.pulseSeq).toBe(0)
    state = applyFloorEvent(state, {
      type: 'tool_result',
      toolCallId: 'tc-f1',
      toolName: 'write_file',
      output: [],
    })
    expect(state.pulseSeq).toBe(1)
    expect(state.lastPulse?.agentId).toBe('a')
    expect(state.fsmPhase).toBeNull()
  })

  test('the attribution map is bounded at PENDING_TOOLS_CAP with FIFO eviction', () => {
    let state = applyFloorEvent(createFloorState(), {
      type: 'subagent_start',
      agentId: 'a',
      agentType: 'scout',
      displayName: 'Scout',
      onlyChild: false,
    })
    for (let i = 0; i < PENDING_TOOLS_CAP + 3; i += 1) {
      state = applyFloorEvent(state, {
        type: 'tool_call',
        toolCallId: `tc-${i}`,
        toolName: 'code_search',
        input: {},
        agentId: 'a',
      })
    }
    expect(state.pendingTools.size).toBe(PENDING_TOOLS_CAP)
    // Oldest entries were evicted FIFO; newest survive.
    expect(state.pendingTools.has('tc-0')).toBe(false)
    expect(state.pendingTools.has(`tc-${PENDING_TOOLS_CAP + 2}`)).toBe(true)
  })
})
