// Sdk-event-handlers test family — underscore direct-tool alias matching to
// hyphenated agent ids across the full spawn lifecycle. Sibling of the
// Loop-347 decomposition (shared fixtures in
// ./sdk-event-handlers-test-harness).

import {
  createEventHandler,
  createStreamChunkHandler,
  createTestContext,
  describe,
  expect,
  test,
} from './sdk-event-handlers-test-harness'

import type { AgentContentBlock } from '../../types/chat'

describe('sdk-event-handlers', () => {
  test('matches underscore direct-tool aliases to hyphenated agent ids', () => {
    const { ctx, getMessages, getStreamingAgents } = createTestContext()
    const handleEvent = createEventHandler(ctx)
    const handleChunk = createStreamChunkHandler(ctx)

    handleEvent({
      type: 'tool_call',
      toolCallId: 'tool-1',
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'code_reviewer_lite',
            prompt: 'Review this change',
          },
        ],
      },
      agentId: 'main-agent',
      parentAgentId: undefined,
    } as any)

    handleEvent({
      type: 'subagent_start',
      agentId: 'agent-real',
      agentType: 'code-reviewer-lite',
      displayName: 'Code Reviewer Lite',
      onlyChild: true,
      parentAgentId: undefined,
      params: undefined,
      prompt: 'Review this change',
    })

    handleChunk({
      type: 'subagent_chunk',
      agentId: 'agent-real',
      agentType: 'code-reviewer-lite',
      chunk: 'streamed review',
    })

    handleEvent({
      type: 'subagent_finish',
      agentId: 'agent-real',
      agentType: 'code-reviewer-lite',
      displayName: 'Code Reviewer Lite',
      onlyChild: true,
      parentAgentId: undefined,
      params: undefined,
      prompt: 'Review this change',
    })

    handleEvent({
      type: 'tool_result',
      toolCallId: 'tool-1',
      toolName: 'spawn_agents',
      output: [
        {
          type: 'json',
          value: [
            {
              agentName: 'code-reviewer-lite',
              agentType: 'code-reviewer-lite',
              value: 'streamed review',
            },
          ],
        },
      ],
    } as any)

    const blocks = getMessages()[0].blocks ?? []
    expect(blocks).toHaveLength(1)
    const agentBlock = blocks[0] as AgentContentBlock
    expect(agentBlock.agentId).toBe('agent-real')
    expect(agentBlock.agentName).toBe('code-reviewer-lite')
    expect(agentBlock.agentType).toBe('code-reviewer-lite')
    expect(agentBlock.status).toBe('complete')
    expect(agentBlock.blocks).toHaveLength(1)
    expect(agentBlock.blocks?.[0]).toMatchObject({
      type: 'text',
      content: 'streamed review',
    })
    expect(getStreamingAgents().size).toBe(0)
  })
})
