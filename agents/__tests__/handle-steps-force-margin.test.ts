import { describe, expect, test } from 'bun:test'

import { createSavantHandleSteps } from '../savant/handle-steps-factory'

/**
 * FID-2026-1009-003 L3/L4 pins for the serialized savant handleSteps
 * generator's force-compaction path.
 *
 * L3 — proportional force margin: `forceMargin = max(forceCompactOffset,
 * floor(window × 2%))`. The configured 15k offset is a floor; large windows
 * get a proportional margin so a single large tool result cannot jump the
 * force trigger and hit the hard budget wall between steps. At 1M: 20k.
 *
 * L4 — escalation-ladder reset on the force path: after a successful forced
 * compaction the count drops far below the held baseline, so the hold
 * release (count ≥ baseline × 1.05) can never re-cross it — proactive
 * passes would stay blocked for the rest of the session. The forced pass
 * supersedes the ladder: stage and baseline reset, so the next turn
 * compacts proactively again.
 *
 * Drive contract: the generator yields either a spawn object or the string
 * 'STEP'; resuming with the full STEP payload (see `resume`) continues the
 * loop. The spawn boundary (which stamps lastPrunerCompletionAt in
 * production) is not run here — the fixture state is mutated directly
 * between yields.
 */

type SpawnYield = {
  toolName: string
  input: { agent_type: string; params: Record<string, unknown> }
}

type FixtureState = {
  agentId: string
  runId: string
  messageHistory: Array<{ role: 'user'; tags: string[]; content: string }>
  maxContextLength: number
  contextTokenCount: number
  compactionStatus?: {
    phase: string
    percentUsed?: number
    blockReason?: string
  }
  lastPrunerCompletionAt?: number
}

function makeState(overrides: Partial<FixtureState>): FixtureState {
  return {
    agentId: 'agent-under-test',
    runId: 'run-1',
    messageHistory: [{ role: 'user', tags: [], content: 'earlier turn' }],
    maxContextLength: 1_000_000,
    contextTokenCount: 900_000,
    lastPrunerCompletionAt: 0,
    ...overrides,
  }
}

function drive(state: FixtureState) {
  const handleSteps = createSavantHandleSteps({
    defaultMaxContextLength: 250_000,
  })
  return handleSteps({
    params: {},
    agentState: state as never,
    logger: undefined,
  } as never)
}

function resume(gen: ReturnType<typeof drive>, state: FixtureState) {
  // The STEP yield's resume payload carries the updated agent state and
  // tool results; the generator only destructures stepsComplete, so the
  // fixture state is passed back verbatim.
  return gen.next({
    agentState: state as never,
    toolResult: [],
    stepsComplete: false,
  })
}

function isPrunerSpawn(value: unknown): value is SpawnYield {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as SpawnYield).toolName === 'spawn_agent_inline' &&
    (value as SpawnYield).input?.agent_type === 'context-pruner'
  )
}

describe('savant handleSteps proportional force margin (FID-2026-1009-003 L3)', () => {
  test('a 1M window force-compacts inside the old 15k margin band (2% = 20k)', () => {
    // count 981k is above the new 980k force threshold but below the old
    // 985k one; the proactive path is cooldown-blocked (a pruner just
    // completed), so only the force path can fire. Pre-L3 this evaluation
    // yielded 'STEP' — no compaction at all.
    const state = makeState({
      contextTokenCount: 981_000,
      lastPrunerCompletionAt: Date.now(),
    })

    const first = drive(state).next()

    expect(first.done).toBe(false)
    const spawned = first.value as SpawnYield
    expect(spawned.toolName).toBe('spawn_agent_inline')
    expect(spawned.input.agent_type).toBe('context-pruner')
    expect(spawned.input.params.force).toBe(true)
    expect(state.compactionStatus).toEqual({ phase: 'compacting' })
  })

  test('the 15k floor still governs small windows (2% of 200k is only 4k)', () => {
    // 184_999 sits below the floor threshold (200k − 15k); with the
    // proactive path cooldown-blocked nothing may fire.
    const below = makeState({
      maxContextLength: 200_000,
      contextTokenCount: 184_999,
      lastPrunerCompletionAt: Date.now(),
    })
    const firstBelow = drive(below).next()
    expect(firstBelow.done).toBe(false)
    expect(isPrunerSpawn(firstBelow.value)).toBe(false)
    expect(below.compactionStatus).toBeUndefined()

    // The floor boundary itself still fires.
    const atFloor = makeState({
      maxContextLength: 200_000,
      contextTokenCount: 185_001,
      lastPrunerCompletionAt: Date.now(),
    })
    const firstAtFloor = drive(atFloor).next()
    const spawned = firstAtFloor.value as SpawnYield
    expect(spawned.toolName).toBe('spawn_agent_inline')
    expect(spawned.input.agent_type).toBe('context-pruner')
    expect(spawned.input.params.force).toBe(true)
  })
})

describe('savant handleSteps escalation-hold release on the force path (FID-2026-1009-003 L4)', () => {
  test('a forced pass resets the escalation ladder so proactive compaction resumes', () => {
    // Arm the hold: two judged-ineffective proactive passes (the count
    // stays at 940k — above the 800k trigger, below the 980k force
    // margin) escalate the ladder to stage 2 with holdBaselineCount =
    // 940k. The hold blocks proactive spawns until the count re-crosses
    // 987k (baseline × 1.05).
    const state = makeState({
      contextTokenCount: 940_000,
      lastPrunerCompletionAt: 0,
    })
    const gen = drive(state)

    // Iteration 1: proactive spawn (awaitingEffectCheck armed).
    const y1 = gen.next()
    expect(isPrunerSpawn(y1.value)).toBe(true)
    // Iteration 1 STEP yield.
    expect(resume(gen, state).value).toBe('STEP')

    // Iteration 2: the effect is judged ineffective (still above the
    // trigger) → stage 1; proactive spawn again.
    const y3 = resume(gen, state)
    expect(isPrunerSpawn(y3.value)).toBe(true)
    expect(resume(gen, state).value).toBe('STEP')

    // Iteration 3: stage 2, baseline 940k; hold armed (940k < 987k),
    // proactive blocked, no spawn.
    expect(resume(gen, state).value).toBe('STEP')
    expect(state.compactionStatus).toEqual({
      phase: 'blocked',
      percentUsed: 94,
      blockReason: 'escalation-hold',
    })

    // Iteration 4: cross the force margin (985k > 980k; below the 987k
    // hold-release bar, so the pre-existing release does not fire) → the
    // forced spawn fires AND resets the ladder.
    state.contextTokenCount = 985_000
    const y6 = resume(gen, state)
    const spawned4 = y6.value as SpawnYield
    expect(spawned4.toolName).toBe('spawn_agent_inline')
    expect(spawned4.input.agent_type).toBe('context-pruner')
    expect(spawned4.input.params.force).toBe(true)
    expect(resume(gen, state).value).toBe('STEP')

    // Iteration 5: the post-compaction count drops back below the force
    // margin (850k, still above the 800k trigger). Pre-L4 the hold (stage
    // 2, baseline 940k) stayed armed and blocked the proactive path until
    // the count re-crossed 987k — a bar a successful compaction can never
    // re-cross. With the ladder reset, the next evaluation spawns
    // proactively again.
    state.contextTokenCount = 850_000
    const y8 = resume(gen, state)
    const spawned5 = y8.value as SpawnYield
    expect(spawned5.toolName).toBe('spawn_agent_inline')
    expect(spawned5.input.agent_type).toBe('context-pruner')
  })
})
