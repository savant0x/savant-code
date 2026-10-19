import { printModeSubagentStartSchema } from '@savant-code/common/types/print-mode'

import {
  createEventHandler,
  createStreamChunkHandler,
  createTestContext,
  describe,
  expect,
  test,
} from './sdk-event-handlers-test-harness'
import { findMatchingSpawnAgent } from '../spawn-agent-matcher'

import type { AgentContentBlock } from '../../types/chat'

describe('FID-2026-1019-002: concurrent child identity', () => {
  test('reversed same-role starts keep streams, prompts and final results on their original rows', () => {
    const context = createTestContext()
    const event = createEventHandler(context.ctx)
    const chunk = createStreamChunkHandler(context.ctx)
    const prompts = ['Review A', 'Review B', 'Review C']
    event({
      type: 'tool_call',
      toolCallId: 'batch',
      toolName: 'spawn_agents',
      input: {
        agents: prompts.map((prompt) => ({ agent_type: 'verifier', prompt })),
      },
    })
    for (const index of [2, 0, 1]) {
      event(
        printModeSubagentStartSchema.parse({
          type: 'subagent_start',
          agentId: `child-${index}`,
          agentType: 'verifier',
          displayName: 'Verifier',
          onlyChild: false,
          prompt: prompts[index],
          spawnOrigin: { toolCallId: 'batch', index },
        }),
      )
      chunk({
        type: 'subagent_chunk',
        agentId: `child-${index}`,
        agentType: 'verifier',
        chunk: `Preview ${index}`,
      })
    }
    expect(context.getStreamingAgents().size).toBe(3)
    for (const index of [1, 2, 0]) {
      event({
        type: 'subagent_finish',
        agentId: `child-${index}`,
        agentType: 'verifier',
        displayName: 'Verifier',
        onlyChild: false,
        spawnOrigin: { toolCallId: 'batch', index },
      })
    }
    event({
      type: 'tool_result',
      toolCallId: 'batch',
      toolName: 'spawn_agents',
      output: [
        {
          type: 'json',
          value: prompts.map((_, index) => ({
            agentType: 'verifier',
            agentName: 'Verifier',
            value: `Final ${index}`,
          })),
        },
      ],
    })
    const blocks = (context.getMessages()[0].blocks ?? []).filter(
      (block): block is AgentContentBlock => block.type === 'agent',
    )
    expect(blocks).toHaveLength(3)
    for (const [index, block] of blocks.entries()) {
      expect(block.agentId).toBe(`child-${index}`)
      expect(block.initialPrompt).toBe(prompts[index])
      expect(block.spawnIndex).toBe(index)
      expect(block.status).toBe('complete')
      expect(block.blocks).toMatchObject([
        { type: 'text', content: `Final ${index}` },
      ])
    }
    expect(context.getStreamingAgents().size).toBe(0)
    expect(context.streamRefs.state.spawnAgentsMap.size).toBe(0)
  })

  test('identical roles and prompts in overlapping batches match by tool call identity', () => {
    const context = createTestContext()
    const event = createEventHandler(context.ctx)
    for (const toolCallId of ['batch-one', 'batch-two']) {
      event({
        type: 'tool_call',
        toolCallId,
        toolName: 'spawn_agents',
        input: { agents: [{ agent_type: 'verifier', prompt: 'Same prompt' }] },
      })
    }
    event({
      type: 'subagent_start',
      agentId: 'second-child',
      agentType: 'verifier',
      displayName: 'Verifier',
      onlyChild: true,
      spawnOrigin: { toolCallId: 'batch-two', index: 0 },
    })
    const blocks = context.getMessages()[0].blocks ?? []
    expect(blocks[0]).toMatchObject({ agentId: 'batch-one-0' })
    expect(blocks[1]).toMatchObject({
      agentId: 'second-child',
      spawnToolCallId: 'batch-two',
    })
  })

  test('explicit missing or mismatched origins never consume a different row; legacy events still match', () => {
    const map = new Map([
      ['batch-0', { index: 0, agentType: 'researcher-web' }],
    ])
    expect(
      findMatchingSpawnAgent(map, 'researcher_web', {
        toolCallId: 'other',
        index: 0,
      }),
    ).toBeNull()
    expect(
      findMatchingSpawnAgent(map, 'verifier', {
        toolCallId: 'batch',
        index: 0,
      }),
    ).toBeNull()
    expect(
      findMatchingSpawnAgent(map, 'researcher_web', {
        toolCallId: 'batch',
        index: 0,
      })?.tempId,
    ).toBe('batch-0')
    expect(findMatchingSpawnAgent(map, 'researcher_web')?.tempId).toBe(
      'batch-0',
    )
  })
})
