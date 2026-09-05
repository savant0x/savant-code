// Sdk-event-handlers test family — spawn_agents params preservation and tool
// result handling. Sibling of the Loop-347 decomposition (shared fixtures in
// ./sdk-event-handlers-test-harness).

import {
  createAgentBlock,
  createEventHandler,
  createTestContext,
  describe,
  expect,
  test,
} from './sdk-event-handlers-test-harness'

import type { ToolResultEvent } from './sdk-event-handlers-test-harness'
import type { AgentContentBlock } from '../../types/chat'

describe('sdk-event-handlers', () => {
  test('preserves spawn_agents params on placeholder agent blocks', () => {
    const { ctx, getMessages, getStreamingAgents } = createTestContext()
    const handleEvent = createEventHandler(ctx)

    handleEvent({
      type: 'tool_call',
      toolCallId: 'tool-1',
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'basher',
            params: {
              command: 'git status --short',
              what_to_summarize: 'Report whether the worktree is clean',
            },
          },
        ],
      },
      agentId: 'main-agent',
      parentAgentId: undefined,
    } as any)

    const agentBlock = (getMessages()[0].blocks ?? [])[0] as AgentContentBlock
    expect(agentBlock.agentId).toBe('tool-1-0')
    expect(agentBlock.agentType).toBe('basher')
    expect(agentBlock.initialPrompt).toBe('')
    expect(agentBlock.params).toEqual({
      command: 'git status --short',
      what_to_summarize: 'Report whether the worktree is clean',
    })
    expect(getStreamingAgents().has('tool-1-0')).toBe(true)
  })

  test('handles spawn_agents tool results and clears streaming agents', () => {
    const { ctx, getMessages, getStreamingAgents } = createTestContext()
    ctx.message.updater.addBlock(
      createAgentBlock({
        agentId: 'tool-1-0',
        agentType: 'temp',
        spawnToolCallId: 'tool-1',
        spawnIndex: 0,
      }),
    )
    ctx.streaming.setStreamingAgents(() => new Set(['tool-1-0']))

    const handleEvent = createEventHandler(ctx)
    const toolResultEvent: ToolResultEvent = {
      type: 'tool_result',
      toolCallId: 'tool-1',
      toolName: 'spawn_agents',
      output: [
        {
          type: 'json',
          value: [
            {
              agentName: 'child',
              value: 'child result',
            },
          ],
        },
      ],
    }
    handleEvent(toolResultEvent)

    const agentBlock = (getMessages()[0].blocks ?? [])[0] as AgentContentBlock
    expect(agentBlock.status).toBe('complete')
    expect(agentBlock.blocks?.[0]).toMatchObject({
      type: 'text',
      content: 'child result',
    })
    expect(getStreamingAgents().size).toBe(0)
  })
})
