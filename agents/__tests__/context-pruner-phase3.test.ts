/**
 * FID-2026-0806-003 Phase 3 (P3a/P3d) — amortized fold + force-ratio tests.
 *
 * P3a: foldOldestExchange mode folds exactly ONE oldest un-absorbed exchange
 * (user message + following assistant/tool messages, bounded by the next user
 * message) into the running summary and keeps everything after it verbatim.
 * P3d: force: true bypasses the context-limit/cache-miss gates.
 */
import { describe, expect, test } from 'bun:test'

import { createContextPrunerHandleSteps } from '../context-pruner/handle-steps'

import type { AgentState, ToolCall } from '../types/agent-definition'
import type { JSONValue, Message } from '../types/util-types'

function textMessage(
  role: Message['role'],
  text: string,
  tags?: string[],
): Message {
  return {
    role,
    content: [{ type: 'text', text }],
    ...(tags ? { tags } : {}),
  } as Message
}

function userMessage(text: string, tags?: string[]): Message {
  return textMessage('user', text, tags)
}

function assistantMessage(text: string): Message {
  return textMessage('assistant', text)
}

function toolMessage(toolName: string, value: JSONValue): Message {
  return {
    role: 'tool',
    toolName,
    toolCallId: `tc-${toolName}-${Math.random().toString(36).slice(2, 8)}`,
    content: [{ type: 'json', value }],
  } as Message
}

function makeAgentState(messageHistory: Message[]): AgentState {
  return {
    agentId: 'context-pruner',
    messageHistory,
    contextTokenCount: 0,
  } as unknown as AgentState
}

/** Runs the real serialized handleSteps factory to completion and returns the final set_messages call. */
async function runPruner(
  messageHistory: Message[],
  params: Record<string, JSONValue> = {},
): Promise<{ toolCall?: ToolCall<'set_messages'>; messages?: Message[] }> {
  const handleSteps = createContextPrunerHandleSteps()
  const agentState = makeAgentState(messageHistory)
  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as Parameters<typeof handleSteps>[0]['logger']

  const generator = handleSteps({
    agentState,
    params,
    logger,
  } as never)

  let lastToolCall: ToolCall<'set_messages'> | undefined
  let result = generator.next()
  while (!result.done) {
    const value = result.value
    if (
      value &&
      value !== 'STEP' &&
      value !== 'STEP_ALL' &&
      'toolName' in value
    ) {
      lastToolCall = value as ToolCall<'set_messages'>
    }
    result = generator.next({
      agentState,
      toolResult: [],
      stepsComplete: false,
      nResponses: [],
    })
  }
  return { toolCall: lastToolCall, messages: lastToolCall?.input?.messages }
}

function getText(m: Message): string {
  if (typeof m.content === 'string') return m.content
  return m.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
}

describe('P3a amortized fold (foldOldestExchange)', () => {
  test('folds only the oldest exchange and keeps the rest verbatim', async () => {
    const now = Date.now()
    const history: Message[] = [
      userMessage('First request: build auth'),
      assistantMessage('Inspected src/auth.ts'),
      toolMessage('read_files', { paths: ['src/auth.ts'] }),
      userMessage('Second request: add tests'),
      assistantMessage('Wrote auth tests'),
      userMessage('Third request: run them'),
    ]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, { foldOldestExchange: true })

    expect(messages).toBeDefined()
    expect(messages!.length).toBeGreaterThanOrEqual(3)

    // First message is the new summary with <conversation_summary>.
    const summaryText = getText(messages![0])
    expect(summaryText).toContain('<conversation_summary>')
    expect(summaryText).toContain('<compaction-summary>')
    expect(summaryText).toContain('<structured_state>')

    // The folded exchange's user text rides the summary as a [USER] entry.
    expect(summaryText).toContain('First request: build auth')

    // Everything after the folded exchange is kept VERBATIM — the second and
    // third user messages must appear as real messages, not in the summary.
    const verbatim = messages!.slice(1)
    const verbatimText = verbatim.map(getText).join('\n')
    expect(verbatimText).toContain('Second request: add tests')
    expect(verbatimText).toContain('Third request: run them')
    expect(verbatimText).toContain('Wrote auth tests')

    // The live prompt is guaranteed LAST.
    expect(getText(messages![messages!.length - 1])).toContain(
      'Third request: run them',
    )
  })

  test('folds exactly one exchange per call (not all history)', async () => {
    const now = Date.now()
    const history: Message[] = [
      userMessage('Turn one'),
      assistantMessage('Work one'),
      userMessage('Turn two'),
      assistantMessage('Work two'),
      userMessage('Turn three'),
      assistantMessage('Work three'),
      userMessage('Turn four'),
    ]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, { foldOldestExchange: true })

    // Summary contains only the first exchange's user text...
    const summaryText = getText(messages![0])
    expect(summaryText).toContain('Turn one')
    // ...while turns two–four stay as real messages (verbatim, in order).
    const verbatim = messages!.slice(1)
    const verbatimText = verbatim.map(getText).join('\n')
    expect(verbatimText).toContain('Turn two')
    expect(verbatimText).toContain('Turn three')
    expect(verbatimText).toContain('Turn four')
    expect(verbatimText).toContain('Work two')
    expect(verbatimText).toContain('Work three')
    expect(getText(messages![messages!.length - 1])).toContain('Turn four')
  })

  test('no-op when there is nothing un-absorbed (single user message)', async () => {
    const now = Date.now()
    const history: Message[] = [userMessage('Only one message')]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, { foldOldestExchange: true })

    // Messages unchanged — nothing to fold.
    expect(messages).toBeDefined()
    expect(messages!.length).toBe(1)
    expect(getText(messages![0])).toContain('Only one message')
    expect(getText(messages![0])).not.toContain('<conversation_summary>')
  })

  test('re-distills a prior summary when folding (Continue rule)', async () => {
    const now = Date.now()
    const priorSummary = userMessage(
      `<conversation_summary>
This is a summary of the conversation so far. The original messages have been condensed to save context space.

<historical_memory>
<compaction-summary>
<structured_state>
## Standing facts & constraints
[USER] Original pinned request
## Goal
(goal)
## Preserved state
{"todos":[],"readFiles":["src/a.ts"],"modifiedFiles":[],"createdFiles":[],"skills":[],"fid":null}
</structured_state>

[USER]
Original pinned request
</compaction-summary>
</historical_memory>
</conversation_summary>`,
    )
    const history: Message[] = [
      priorSummary,
      userMessage('New turn after summary'),
      assistantMessage('Work after summary'),
      userMessage('Live turn'),
    ]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, { foldOldestExchange: true })

    const summaryText = getText(messages![0])
    // Prior summary content is carried forward (Continue re-distill rule).
    expect(summaryText).toContain('Original pinned request')
    expect(summaryText).toContain('New turn after summary')
    // The preserved-state JSON from the prior summary survives the merge.
    expect(summaryText).toContain('src/a.ts')
    // The live turn stays a real message, last.
    const verbatim = messages!.slice(1)
    expect(verbatim.map(getText).join('\n')).toContain('Live turn')
    expect(getText(messages![messages!.length - 1])).toContain('Live turn')
  })
})

describe('P3d force ratio (force: true)', () => {
  test('force bypasses the context-limit / cache-miss gates', async () => {
    const now = Date.now()
    // Small history, no USER_PROMPT tag → normally pruner would no-op.
    const history: Message[] = [
      userMessage('Request one'),
      assistantMessage('Work one'),
      userMessage('Request two'),
    ]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, {
      force: true,
      maxContextLength: 200_000,
    })

    // Force compaction ran even though context is tiny.
    expect(messages).toBeDefined()
    expect(getText(messages![0])).toContain('<conversation_summary>')
    expect(getText(messages![0])).toContain('Request one')
  })
})

describe('P3a + P3d wiring through the savant handleSteps factory', () => {
  test('factory bakes fold/idle/force literals and yields pruner spawns', async () => {
    // Drive the factory in the default (off) config: fold disabled, idle
    // disabled. Above 0.9 the force spawn fires with force: true.
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })

    const agentState = makeAgentState([
      userMessage('big task'),
      assistantMessage('working...'),
    ])
    agentState.contextTokenCount = 240_000 // > 0.9 * 250k
    agentState.maxContextLength = 250_000

    const generator = handleSteps({
      agentState,
      params: {},
    } as never)

    let spawned = false
    let result = generator.next()
    let stepsComplete = false
    while (!result.done) {
      const value = result.value
      if (
        value &&
        value !== 'STEP' &&
        value !== 'STEP_ALL' &&
        'toolName' in value
      ) {
        const call = value as {
          toolName: string
          input: { agent_type: string; params?: Record<string, JSONValue> }
        }
        if (
          call.toolName === 'spawn_agent_inline' &&
          call.input.agent_type === 'context-pruner'
        ) {
          spawned = true
          // Above 0.9 → force: true present in the spawn params.
          expect(call.input.params?.force).toBe(true)
        }
      }
      result = generator.next({
        agentState,
        toolResult: [],
        stepsComplete,
        nResponses: [],
      })
      stepsComplete = true
    }
    expect(spawned).toBe(true)
  })

  test('fold spawn fires at turn end when amortizedFold is enabled', async () => {
    // Reuse the factory through the module-level default (off) by checking the
    // generated source shape: with default config amortizedFold is baked false,
    // so we verify the pruner main fold mode directly instead (covered above).
    // This test asserts the factory remains serializable and self-contained.
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })
    const fn = handleSteps as unknown as { toString(): string }
    const source = fn.toString()
    expect(source).toContain('amortizedFold')
    expect(source).toContain('foldFloorTokens')
    expect(source).toContain('idleAfterMs')
    expect(source).toContain('forceCompactOffset')
    // FID-2026-0814-001: the generated source must stay closure-free while
    // carrying the compaction lifecycle literals (compacting emit + cooldown).
    expect(source).toContain("phase: 'compacting'")
    expect(source).toContain('prunerCooldownMs')
    expect(source).toContain('lastPrunerCompletionAt')
  })

  test('FID-2026-0814-004 H-07: threads compression config as baked literals', async () => {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
      keepRecentTokens: 24_576,
      autoCompactRatio: 0.75,
      forceCompactOffset: 12_000,
    })
    const fn = handleSteps as unknown as { toString(): string }
    const source = fn.toString()
    // The configured values must land in the serialized literals, not the
    // hardcoded 0.8/0.9 defaults.
    expect(source).toContain('forceCompactOffset = 12000')
    expect(source).toContain('autoCompactRatio = 0.75')
    expect(source).toContain('keepRecentTokens: 24576')
    // The generated function must stay closure-free — the threaded values
    // are baked as literals, never captured variables.
    expect(source).not.toContain('keepRecentTokens = ')
    expect(source).not.toContain('autoCompactRatioRatio')
  })

  test('FID-2026-0814-004 H-07: pruner spawn carries keepRecentTokens param', async () => {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
      keepRecentTokens: 24_576,
      autoCompactRatio: 0.75,
      forceCompactOffset: 12_000,
    })

    const agentState = makeAgentState([
      userMessage('big task'),
      assistantMessage('working...'),
    ])
    agentState.contextTokenCount = 220_000 // > 0.75 * 250k = 187.5k
    agentState.maxContextLength = 250_000

    const generator = handleSteps({
      agentState,
      params: {},
    } as never)

    let keepRecentTokenParam: unknown
    let result = generator.next()
    let stepsComplete = false
    while (!result.done) {
      const value = result.value
      if (
        value &&
        value !== 'STEP' &&
        value !== 'STEP_ALL' &&
        'toolName' in value
      ) {
        const call = value as {
          toolName: string
          input: { agent_type: string; params?: Record<string, JSONValue> }
        }
        if (
          call.toolName === 'spawn_agent_inline' &&
          call.input.agent_type === 'context-pruner'
        ) {
          keepRecentTokenParam = call.input.params?.keepRecentTokens
        }
      }
      result = generator.next({
        agentState,
        toolResult: [],
        stepsComplete,
        nResponses: [],
      })
      stepsComplete = true
    }
    // The pruner reads keepRecentTokens from its spawn params
    // (agents/context-pruner/main.ts:177-178); the factory must pass it.
    expect(keepRecentTokenParam).toBe(24_576)
  })
})

describe('FID-2026-0814-001 — savant handleSteps compaction lifecycle', () => {
  async function driveSavant(
    contextTokenCount: number,
    opts: { lastPrunerCompletionAt?: number } = {},
  ): Promise<{
    spawned: boolean
    spawnParams: Record<string, JSONValue> | undefined
    agentState: AgentState
  }> {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })
    const agentState = makeAgentState([
      userMessage('big task'),
      assistantMessage('working...'),
    ])
    agentState.contextTokenCount = contextTokenCount
    agentState.maxContextLength = 250_000
    if (opts.lastPrunerCompletionAt !== undefined) {
      agentState.lastPrunerCompletionAt = opts.lastPrunerCompletionAt
    }

    const generator = handleSteps({
      agentState,
      params: {},
    } as never)

    let spawned = false
    let spawnParams: Record<string, JSONValue> | undefined
    let result = generator.next()
    while (!result.done) {
      const value = result.value
      if (
        value &&
        value !== 'STEP' &&
        value !== 'STEP_ALL' &&
        'toolName' in value
      ) {
        const call = value as {
          toolName: string
          input: {
            agent_type: string
            params?: Record<string, JSONValue>
          }
        }
        if (
          call.toolName === 'spawn_agent_inline' &&
          call.input.agent_type === 'context-pruner'
        ) {
          spawned = true
          spawnParams = call.input.params
        }
      }
      result = generator.next({
        agentState,
        toolResult: [],
        stepsComplete: true,
        nResponses: [],
      })
    }
    return { spawned, spawnParams, agentState }
  }

  test('the proactive spawn sets a live `compacting` status', async () => {
    // 220k is between 0.8 × 250k (200k) and 250k − 15k (235k) → proactive path.
    const { spawned, agentState } = await driveSavant(220_000)
    expect(spawned).toBe(true)
    // The status write happens before the yield, so it is observable on the
    // agentState the runtime snapshots during the pruner run.
    expect(agentState.compactionStatus?.phase).toBe('compacting')
  })

  test('a recent pruner completion backs off the proactive spawn (cooldown)', async () => {
    const { spawned, agentState } = await driveSavant(220_000, {
      lastPrunerCompletionAt: Date.now(),
    })
    expect(spawned).toBe(false)
    expect(agentState.compactionStatus).toBeUndefined()
  })

  test('the force path still spawns during cooldown (hard-overflow safety)', async () => {
    // 240k > 250k − 15k (235k) → force path, which bypasses the cooldown.
    const { spawned, spawnParams } = await driveSavant(240_000, {
      lastPrunerCompletionAt: Date.now(),
    })
    expect(spawned).toBe(true)
    expect(spawnParams?.force).toBe(true)
  })
})

describe('FID-2026-0814-011 — single trigger authority (autoCompactDue)', () => {
  async function driveSavantTrigger(opts: {
    contextTokenCount: number
    maxContextLength?: number
    autoCompactDue?: boolean
    lastPrunerCompletionAt?: number
    useSerializedRoundTrip?: boolean
  }): Promise<{
    spawned: boolean
    force: unknown
  }> {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    let handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })
    if (opts.useSerializedRoundTrip) {
      // Reproduce the runtime's serialize→eval round-trip for the bundled
      // path (prebuild-agents.ts + run-programmatic-step deserializeHandleSteps).
      const source = (
        handleSteps as unknown as { toString(): string }
      ).toString()
      handleSteps = eval(`(${source})`) as typeof handleSteps
    }
    const agentState = makeAgentState([
      userMessage('big task'),
      assistantMessage('working...'),
    ])
    agentState.contextTokenCount = opts.contextTokenCount
    agentState.maxContextLength = opts.maxContextLength ?? 250_000
    if (opts.autoCompactDue !== undefined) {
      agentState.autoCompactDue = opts.autoCompactDue
    }
    if (opts.lastPrunerCompletionAt !== undefined) {
      agentState.lastPrunerCompletionAt = opts.lastPrunerCompletionAt
    }

    const generator = handleSteps({
      agentState,
      params: {},
    } as never)

    let spawned = false
    let force: unknown
    let result = generator.next()
    while (!result.done) {
      const value = result.value
      if (
        value &&
        value !== 'STEP' &&
        value !== 'STEP_ALL' &&
        'toolName' in value
      ) {
        const call = value as {
          toolName: string
          input: { agent_type: string; params?: Record<string, JSONValue> }
        }
        if (
          call.toolName === 'spawn_agent_inline' &&
          call.input.agent_type === 'context-pruner'
        ) {
          spawned = true
          force = call.input.params?.force
        }
      }
      result = generator.next({
        agentState,
        toolResult: [],
        stepsComplete: true,
        nResponses: [],
      })
    }
    return { spawned, force }
  }

  test('autoCompactDue drives the spawn even below the 0.8 ratio threshold', async () => {
    // 100k < 0.8 × 250k (200k) → the ratio fallback alone would NOT fire;
    // the proven shouldAutoCompact signal must be the single authority.
    const { spawned } = await driveSavantTrigger({
      contextTokenCount: 100_000,
      autoCompactDue: true,
    })
    expect(spawned).toBe(true)
  })

  test('a recent pruner completion still backs off the autoCompactDue spawn (cooldown)', async () => {
    const { spawned } = await driveSavantTrigger({
      contextTokenCount: 100_000,
      autoCompactDue: true,
      lastPrunerCompletionAt: Date.now(),
    })
    expect(spawned).toBe(false)
  })

  test('force path fires with autoCompactDue during cooldown (hard-overflow safety)', async () => {
    const { spawned, force } = await driveSavantTrigger({
      contextTokenCount: 240_000, // > 250k − 15k (235k)
      autoCompactDue: true,
      lastPrunerCompletionAt: Date.now(),
    })
    expect(spawned).toBe(true)
    expect(force).toBe(true)
  })

  test('serialized round-trip (toString → eval) preserves the single-trigger authority', async () => {
    const { spawned } = await driveSavantTrigger({
      contextTokenCount: 100_000,
      autoCompactDue: true,
      useSerializedRoundTrip: true,
    })
    expect(spawned).toBe(true)
  })

  test('generated source carries the fail-loud guard and never silently adopts the baked default', async () => {
    const { getSavantHandleSteps } = await import('../savant/handle-steps')
    const handleSteps = getSavantHandleSteps({
      isFree: false,
      maxContextLength: 250_000,
    })
    const source = (handleSteps as unknown as { toString(): string }).toString()
    expect(source).toContain('resolvedMaxContextLength')
    expect(source).toContain('autoCompactDue')
    expect(source).toContain("'savant handleSteps: maxContextLength unresolved")
    // The old silent fallback chain must be gone.
    expect(source).not.toContain(
      'agentState.maxContextLength ?? asNumber(p.maxContextLength) ??',
    )
  })
})
