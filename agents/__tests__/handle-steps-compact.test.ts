import { describe, expect, test } from 'bun:test'

import { createSavantHandleSteps } from '../savant/handle-steps-factory'

/**
 * Factory-level pins for the manual /compact interceptor
 * (FID-2026-0821-001 P1-4; RC1 path-form fix in FID-2026-0822-001).
 *
 * Contract under test: a trailing USER_PROMPT whose payload is `/compact` —
 * XML-framed (`<user_message>/compact</user_message>`) or bare — must
 *   1. set `agentState.compactionStatus = { phase: 'compacting' }`,
 *   2. yield exactly one forced context-pruner spawn (bypasses cooldown),
 *   3. end the turn immediately (compact-and-stop, no LLM summary pass),
 * and any other prompt must never take that path.
 */

type FixtureUserPrompt = {
  role: 'user'
  tags: string[]
  content: string
}

type FixtureState = {
  agentId: string
  runId: string
  parentId?: string
  messageHistory: FixtureUserPrompt[]
  maxContextLength?: number
  contextTokenCount: number
  compactionStatus?: { phase: string; tokensSaved?: number }
  lastPrunerCompletionAt?: number
}

function makeState(
  userPromptContent: string,
  overrides: Partial<FixtureState> = {},
): FixtureState {
  return {
    agentId: 'agent-under-test',
    runId: 'run-1',
    messageHistory: [
      { role: 'user', tags: [], content: 'earlier turn' },
      {
        role: 'user',
        tags: ['USER_PROMPT'],
        content: userPromptContent,
      },
    ],
    maxContextLength: 200_000,
    contextTokenCount: 5_000,
    ...overrides,
  }
}

function makeHandleSteps() {
  return createSavantHandleSteps({ defaultMaxContextLength: 250_000 })
}

type SpawnYield = {
  toolName: string
  input: { agent_type: string; params: Record<string, unknown> }
}

describe('savant handleSteps /compact interceptor (FID-2026-0821-001 P1-4)', () => {
  test('XML-framed /compact sets compacting status and force-spawns the pruner', () => {
    const state = makeState('<user_message>/compact</user_message>')
    const handleSteps = makeHandleSteps()

    const gen = handleSteps({
      params: {},
      agentState: state as never,
      logger: undefined,
    } as never)

    const first = gen.next() as IteratorResult<SpawnYield>

    expect(first.done).toBe(false)
    const spawned = first.value as SpawnYield
    expect(spawned.toolName).toBe('spawn_agent_inline')
    expect(spawned.input.agent_type).toBe('context-pruner')
    expect(spawned.input.params.force).toBe(true)

    // V1 visibility: firing is observable immediately.
    expect(state.compactionStatus).toEqual({ phase: 'compacting' })

    // Compact-and-stop: no further steps after the spawn.
    const second = gen.next()
    expect(second.done).toBe(true)
  })

  test('bare-text /compact takes the same forced path (fallback form)', () => {
    const state = makeState('/compact')
    const handleSteps = makeHandleSteps()

    const gen = handleSteps({
      params: {},
      agentState: state as never,
      logger: undefined,
    } as never)

    const first = gen.next() as IteratorResult<SpawnYield>

    const spawned = first.value as SpawnYield
    expect(spawned.toolName).toBe('spawn_agent_inline')
    expect(spawned.input.agent_type).toBe('context-pruner')
    expect(spawned.input.params.force).toBe(true)
    expect(state.compactionStatus).toEqual({ phase: 'compacting' })
  })

  test('a non-compact prompt never routes through the forced pruner', () => {
    const state = makeState('<user_message>hello world</user_message>')
    const handleSteps = makeHandleSteps()

    const gen = handleSteps({
      params: {},
      agentState: state as never,
      logger: undefined,
    } as never)

    const first = gen.next() as IteratorResult<SpawnYield>

    // Consume exactly one step: whatever the normal path yields, it must not
    // be the forced context-pruner spawn, and no compacting status was set.
    const isForcedPrunerSpawn =
      !first.done &&
      typeof first.value === 'object' &&
      (first.value as SpawnYield).toolName === 'spawn_agent_inline' &&
      (first.value as SpawnYield).input?.agent_type === 'context-pruner'
    expect(isForcedPrunerSpawn).toBe(false)
    expect(state.compactionStatus).toBeUndefined()
  })

  test('case-insensitive detection and surrounding whitespace tolerance', () => {
    const state = makeState('<user_message>  /Compact  </user_message>')
    const handleSteps = makeHandleSteps()

    const gen = handleSteps({
      params: {},
      agentState: state as never,
      logger: undefined,
    } as never)

    const first = gen.next() as IteratorResult<SpawnYield>

    const spawned = first.value as SpawnYield
    expect(spawned.input.agent_type).toBe('context-pruner')
    expect(spawned.input.params.force).toBe(true)
  })
})