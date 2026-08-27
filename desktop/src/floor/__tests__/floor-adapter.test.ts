import {
  printModeEventSchema,
  type PrintModeEvent,
} from '@savant-code/common/types/print-mode'
import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import walkerLifecycle from '../__fixtures__/tier-1/walker-lifecycle.json'
import {
  PAD_COUNT,
  PAD_RING_RADIUS,
  PENDING_TOOLS_CAP,
  REASONING_GAP_MS,
  THINKER_BURST_CAP,
  applyFloorEvent,
  applyFloorEvents,
  createFloorState,
  padPosition,
} from '../adapter/floor-adapter'
import { GENERIC_ROLE_ID } from '../roles'

// Schema-parsed (runtime-validated + typed) instead of a blind double-cast:
// the fixtures.test.ts suite pins corpus validity, this parse re-asserts it
// at the point of consumption.
const EVENTS = z.array(printModeEventSchema).parse(walkerLifecycle)

describe('floor adapter — walker-lifecycle fixture (FID-2026-0822-012 P2)', () => {
  test('start seats Savant at the console exactly once', () => {
    const seeded = applyFloorEvent(createFloorState(), EVENTS[0])
    expect(seeded.savantPresent).toBe(true)
    // Re-applying a start is idempotent.
    expect(applyFloorEvent(seeded, EVENTS[0])).toBe(seeded)
  })

  test('subagent_start spawns the detective walker on a ring pad', () => {
    const start = EVENTS.find((event) => event.type === 'subagent_start')
    if (start?.type !== 'subagent_start') throw new Error('fixture drift')
    const state = applyFloorEvent(createFloorState(), start)
    const walker = state.walkers.get(start.agentId)
    expect(walker).toBeDefined()
    expect(walker?.roleId).toBe('detective')
    expect(walker?.phase).toBe('active')
    expect(walker?.padIndex).toBeGreaterThanOrEqual(0)
    expect(walker?.padIndex).toBeLessThan(PAD_COUNT)
  })

  test('full fixture folds to: savant present, detective dissolved', () => {
    const final = applyFloorEvents(createFloorState(), EVENTS)
    expect(final.savantPresent).toBe(true)
    const walker = final.walkers.get('agent-detective-7')
    expect(walker?.roleId).toBe('detective')
    expect(walker?.phase).toBe('dissolved')
  })

  test('unknown agentType casts the generic silhouette', () => {
    const state = applyFloorEvent(createFloorState(), {
      type: 'subagent_start',
      agentId: 'agent-x',
      agentType: 'mystery-bot',
      displayName: 'Mystery Bot',
      onlyChild: false,
    })
    expect(state.walkers.get('agent-x')?.roleId).toBe(GENERIC_ROLE_ID)
  })

  test('pads are deterministic, distinct while active, and reused after dissolve', () => {
    const scoutSpawn = (agentId: string) =>
      ({
        type: 'subagent_start',
        agentId,
        agentType: 'scout',
        displayName: 'Scout',
        onlyChild: false,
      }) as const
    const both = applyFloorEvents(createFloorState(), [
      scoutSpawn('a'),
      scoutSpawn('b'),
    ])
    const padA = both.walkers.get('a')?.padIndex
    const padB = both.walkers.get('b')?.padIndex
    expect(padA).toBeDefined()
    expect(padB).toBeDefined()
    expect(padB === padA).toBe(false)

    const dissolved = applyFloorEvent(both, {
      type: 'subagent_finish',
      agentId: 'a',
      agentType: 'scout',
      displayName: 'Scout',
      onlyChild: false,
    })
    const recycled = applyFloorEvent(dissolved, {
      type: 'subagent_start',
      agentId: 'c',
      agentType: 'scout',
      displayName: 'Scout',
      onlyChild: false,
    })
    expect(recycled.walkers.get('c')?.padIndex).toBe(padA)
  })

  test('a respawning agent never stacks on a pad an active walker holds', () => {
    const spawn = (agentId: string) =>
      ({
        type: 'subagent_start',
        agentId,
        agentType: 'scout',
        displayName: 'Scout',
        onlyChild: false,
      }) as const
    const finishA = {
      type: 'subagent_finish',
      agentId: 'a',
      agentType: 'scout',
      displayName: 'Scout',
      onlyChild: false,
    } as const
    // A spawns (pad X), dissolves; B spawns and takes X's freed pad; A
    // respawns — stickiness must yield because B actively holds pad X.
    const spawnedA = applyFloorEvent(createFloorState(), spawn('a'))
    const dissolvedA = applyFloorEvent(spawnedA, finishA)
    const spawnedB = applyFloorEvent(dissolvedA, spawn('b'))
    const padB = spawnedB.walkers.get('b')!.padIndex
    const respawnedA = applyFloorEvent(spawnedB, spawn('a'))
    const walkerA = respawnedA.walkers.get('a')
    expect(walkerA?.phase).toBe('active')
    expect(walkerA?.padIndex === undefined || walkerA.padIndex !== padB).toBe(
      true,
    )
  })

  test('ring overflow beyond PAD_COUNT shares the lowest held pad', () => {
    const ids = Array.from({ length: PAD_COUNT + 1 }, (_, i) => `w${i}`)
    const state = applyFloorEvents(
      createFloorState(),
      ids.map(
        (agentId) =>
          ({
            type: 'subagent_start',
            agentId,
            agentType: 'scout',
            displayName: 'Scout',
            onlyChild: false,
          }) as const,
      ),
    )
    // w0..w11 fill every pad; w13th arrives onto the lowest held pad.
    expect(state.walkers.get('w0')?.padIndex).toBe(0)
    expect(state.walkers.get(`w${PAD_COUNT}`)?.padIndex).toBe(0)
  })

  test('unrelated events return the same reference (purity contract)', () => {
    const state = createFloorState()
    expect(
      applyFloorEvent(state, {
        type: 'tool_call',
        toolCallId: 'tc',
        toolName: 'read_files',
        input: {},
      }),
    ).toBe(state)
  })

  test('no-op tool edges preserve reference identity (Law-14 edges)', () => {
    const state = applyFloorEvents(createFloorState(), [
      {
        type: 'subagent_start',
        agentId: 'a',
        agentType: 'scout',
        displayName: 'Scout',
        onlyChild: false,
      },
      {
        type: 'tool_call',
        toolCallId: 'tc-1',
        toolName: 'code_search',
        input: {},
        agentId: 'a',
      },
    ])
    // A tool_result for an UNKNOWN toolCallId is a no-op.
    expect(
      applyFloorEvent(state, {
        type: 'tool_result',
        toolCallId: 'tc-never-seen',
        toolName: 'code_search',
        output: [],
      }),
    ).toBe(state)
    // A DUPLICATE tool_call with an already-pending id is a no-op.
    expect(
      applyFloorEvent(state, {
        type: 'tool_call',
        toolCallId: 'tc-1',
        toolName: 'code_search',
        input: {},
        agentId: 'a',
      }),
    ).toBe(state)
  })

  test('pad geometry sits on the deterministic ring', () => {
    const first = padPosition(0)
    expect(first.x).toBeCloseTo(0, 10)
    expect(first.z).toBeCloseTo(PAD_RING_RADIUS, 10)
    const quarter = padPosition(PAD_COUNT / 4)
    expect(quarter.x).toBeCloseTo(PAD_RING_RADIUS, 10)
    expect(quarter.z).toBeCloseTo(0, 10)
  })

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
    // Aura-only entry: pulse attributes to the console (null agentId).
    expect(resolved.lastPulse?.agentId).toBeNull()
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

describe('thinker glyph bursts (FID-2026-0822-012 P5)', () => {
  // Annotated (not `as const`): the schema's `ancestorRunIds` array is
  // mutable, which a fully-frozen literal violates.
  const delta = (agentId: string, runId: string): PrintModeEvent => ({
    type: 'reasoning_delta',
    text: 'thinking out loud',
    ancestorRunIds: ['run-1'],
    runId,
    agentId,
  })

  test('deltas inside the gap extend one burst; a >=1500ms gap opens another', () => {
    let state = applyFloorEvents(createFloorState(), [
      {
        type: 'subagent_start',
        agentId: 'a',
        agentType: 'thinker',
        displayName: 'Thinker',
        onlyChild: true,
      },
    ])
    state = applyFloorEvent(state, delta('a', 'run-a'), 0)
    expect(state.thinkerBursts).toHaveLength(1)
    state = applyFloorEvent(state, delta('a', 'run-a'), REASONING_GAP_MS - 1)
    // Still the same burst — under the idle-gap threshold.
    expect(state.thinkerBursts).toHaveLength(1)
    // Gap from last[a]=1499 to 3000 is 1501 >= threshold -> new burst.
    state = applyFloorEvent(state, delta('a', 'run-b'), REASONING_GAP_MS * 2)
    expect(state.thinkerBursts).toHaveLength(2)
    expect(state.thinkerBursts.map((b) => b.seq)).toEqual([1, 2])
    // Per-agent clocks: another agent's first delta always opens a burst.
    state = applyFloorEvent(state, delta('b', 'run-c'), REASONING_GAP_MS + 1)
    expect(state.thinkerBursts).toHaveLength(3)
    expect(state.thinkerBursts[2].agentId).toBe('b')
  })

  test('the glyph ring keeps only the last THINKER_BURST_CAP bursts', () => {
    let state = createFloorState()
    for (let i = 0; i < THINKER_BURST_CAP + 2; i += 1) {
      state = applyFloorEvent(
        state,
        delta('a', `run-${i}`),
        i * (REASONING_GAP_MS + 1),
      )
    }
    expect(state.thinkerBursts).toHaveLength(THINKER_BURST_CAP)
    const totalBursts = THINKER_BURST_CAP + 2
    // Oldest evicted; the surviving window starts at totalBursts-cap+1.
    expect(state.thinkerBursts[0].seq).toBe(totalBursts - THINKER_BURST_CAP + 1)
  })

  test('reasoning_delta without an injected clock is dropped, not guessed', () => {
    const state = createFloorState()
    expect(applyFloorEvent(state, delta('a', 'run-a'))).toBe(state)
    expect(applyFloorEvent(state, delta('a', 'run-a'), Number.NaN)).toBe(state)
  })
})
