import { type PrintModeEvent } from '@savant-code/common/types/print-mode'
import { describe, expect, test } from 'bun:test'

import {
  REASONING_GAP_MS,
  THINKER_BURST_CAP,
  applyFloorEvent,
  applyFloorEvents,
  createFloorState,
} from '../adapter/floor-adapter'

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
