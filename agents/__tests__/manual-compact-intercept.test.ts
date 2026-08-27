import { buildUserMessageContent } from '@savant-code/agent-runtime/util/messages'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { userMessage } from '@savant-code/common/util/messages'
import { describe, expect, test } from 'bun:test'

import { createSavantHandleSteps } from '../savant/handle-steps-factory'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { AgentState } from '@savant-code/common/types/session-state'

const stubLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

// FID-2026-0822-001 RC1: fixtures MUST use the real production builder.
// The original test hand-built bare-string messages, but production wraps
// every USER_PROMPT in '<user_message>...</user_message>' via
// buildUserMessageContent — which is exactly why the interceptor's raw
// equality compare passed this test while failing live.
function productionPromptHistory(text: string): Message[] {
  return [
    {
      role: 'user',
      content: buildUserMessageContent(text, undefined, undefined),
      tags: ['USER_PROMPT'],
      sentAt: Date.now(),
    },
  ]
}

function makeState(history: Message[]): AgentState {
  return {
    ...getInitialAgentState(),
    contextTokenCount: 5_000,
    maxContextLength: 200_000,
    autoCompactDue: false,
    messageHistory: history,
  }
}

function startGenerator(agentState: AgentState) {
  const handleSteps = createSavantHandleSteps({
    defaultMaxContextLength: 400_000,
  })
  return handleSteps({ agentState, params: {}, logger: stubLogger })
}

describe('manual /compact intercept (FID-2026-0821-001 P1-4; frame fix FID-2026-0822-001)', () => {
  test('production-shaped trailing /compact forces the pruner then compact-and-stop', () => {
    const agentState = makeState(productionPromptHistory('/compact'))
    const gen = startGenerator(agentState)

    const first = gen.next()
    expect(first.done).toBe(false)
    expect(first.value).toMatchObject({
      toolName: 'spawn_agent_inline',
      input: {
        agent_type: 'context-pruner',
        params: { force: true },
      },
    })
    expect(agentState.compactionStatus?.phase).toBe('compacting')

    // Resuming after the spawn boundary: the generator returns — the turn
    // ends without an LLM summary pass (compact-and-stop).
    const second = gen.next({
      agentState,
      toolResult: [],
      stepsComplete: false,
    })
    expect(second.done).toBe(true)
  })

  test('a bare-text /compact message still intercepts (fallback form)', () => {
    const agentState = makeState([
      userMessage({ content: '/compact', tags: ['USER_PROMPT'] }),
    ])
    const gen = startGenerator(agentState)

    const first = gen.next()
    expect(first.done).toBe(false)
    expect(first.value).toMatchObject({
      toolName: 'spawn_agent_inline',
      input: { agent_type: 'context-pruner' },
    })
  })

  test('a normal production-shaped prompt does not intercept', () => {
    const agentState = makeState(productionPromptHistory('fix the login bug'))
    const gen = startGenerator(agentState)

    const first = gen.next()
    expect(first.done).toBe(false)
    expect(first.value).toBe('STEP')
  })

  test('RC2 regression: the proactive threshold spawn carries force:true', () => {
    const agentState = {
      ...makeState(productionPromptHistory('keep working')),
      contextTokenCount: 190_000,
      autoCompactDue: true,
    }
    const gen = startGenerator(agentState)

    const first = gen.next()
    expect(first.done).toBe(false)
    expect(first.value).toMatchObject({
      toolName: 'spawn_agent_inline',
      input: {
        agent_type: 'context-pruner',
        params: { force: true },
      },
    })
    expect(agentState.compactionStatus?.phase).toBe('compacting')
  })
})
