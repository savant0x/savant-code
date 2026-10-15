import { printModeEventSchema } from '@savant-code/common/types/print-mode'
import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import walkerLifecycle from '../__fixtures__/tier-1/walker-lifecycle.json'
import {
  PAD_COUNT,
  PAD_RING_RADIUS,
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

  test('unattributed orchestrator tool calls route to Savant (FID-2026-0828-002 D)', () => {
    // Supersedes the old purity-contract pin: unattributed calls are no
    // longer dropped — they drive Savant's station visit so an
    // orchestrator-only run animates the floor.
    const state = applyFloorEvent(createFloorState(), {
      type: 'tool_call',
      toolCallId: 'tc',
      toolName: 'read_files',
      input: {},
    })
    const walker = state.walkers.get('savant')
    expect(walker?.phase).toBe('active')
    expect(walker?.stationTarget).not.toBeNull()
    expect(state.pendingTools.get('tc')?.agentId).toBe('savant')
  })

  test('attributed call to an UNKNOWN agent routes to Savant (FID-2026-0828-002 D)', () => {
    // The live orchestrator's own tool calls carry agentId like
    // 'orchestrator-1' but never spawn a walker record. The old rule dropped
    // every such call (its owning walker wasn't active), which left the deck
    // dead on orchestrator-only runs: batch after batch showed tools=0,
    // walkers=0 while chat visibly used tools. Now any tool_call whose
    // owning active walker is absent drives Savant at the console instead.
    const state = applyFloorEvent(createFloorState(), {
      type: 'tool_call',
      toolCallId: 'tc-x',
      toolName: 'read_files',
      input: {},
      agentId: 'orchestrator-1',
    })
    const savant = state.walkers.get('savant')
    expect(savant).toBeDefined()
    if (savant === undefined) throw new Error('savant walker missing')
    expect(savant.phase).toBe('active')
    expect(savant.stationTarget).toBe('file-forge') // read_files class
    expect(state.pendingTools.get('tc-x')?.agentId).toBe('savant')
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
})
