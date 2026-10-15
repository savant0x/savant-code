import {
  createEventHandler,
  createStreamChunkHandler,
  createTestContext,
} from './sdk-event-handlers-test-harness'

import type { AgentContentBlock } from '../../types/chat'

export const VERDICT =
  'FAIL art/icons/cyberpunk/logo-sidebar-s.svg:15 — ▄▀ wrong rect -> set y="15"\nNEEDS-REVIEW render — view sidebar ξ 🙂'
export const RAW_REVIEW = '<think>Audit notes</think>\n' + VERDICT

const FINAL_RESULT = {
  type: 'tool_result' as const,
  toolCallId: 'spawn',
  toolName: 'spawn_agents',
  output: [
    {
      type: 'json' as const,
      value: [
        {
          agentName: 'Audit',
          value: {
            type: 'lastMessage',
            value: RAW_REVIEW.split('').map((text) => ({
              role: 'assistant',
              content: [{ type: 'text', text }],
            })),
          },
        },
      ],
    },
  ],
}

export function replayVerifier(
  agentType = 'verifier',
  chunks = RAW_REVIEW.split(''),
): AgentContentBlock {
  const { ctx, getMessages } = createTestContext()
  const event = createEventHandler(ctx)
  event({
    type: 'tool_call',
    toolCallId: 'spawn',
    toolName: 'spawn_agents',
    input: {
      agents: [{ agent_type: agentType, prompt: 'Review visible evidence' }],
    },
  })
  event({
    type: 'subagent_start',
    agentId: 'audit',
    agentType,
    displayName: 'Audit',
    onlyChild: true,
    parentAgentId: undefined,
    params: undefined,
    prompt: 'Review visible evidence',
  })
  const chunk = createStreamChunkHandler(ctx)
  for (const text of chunks)
    chunk({ type: 'subagent_chunk', agentId: 'audit', agentType, chunk: text })
  event({
    type: 'subagent_finish',
    agentId: 'audit',
    agentType,
    displayName: 'Audit',
    onlyChild: true,
  })
  event(FINAL_RESULT)
  event(FINAL_RESULT)
  const agent = getMessages()[0].blocks?.[0]
  if (agent?.type !== 'agent') throw new Error('Missing audit branch')
  return agent
}
