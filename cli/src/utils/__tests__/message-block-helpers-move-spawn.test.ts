// Message-block-helpers test family — moveSpawnAgentBlock: temp-id swap,
// parent nesting, and order preservation when agents resolve out of order.
// Sibling of the Loop 319 decomposition.

import { describe, expect, test } from 'bun:test'

import { moveSpawnAgentBlock } from '../message-block-helpers'

import type { AgentContentBlock, ContentBlock } from '../../types/chat'

describe('moveSpawnAgentBlock', () => {
  test('replaces temp agent id with real id', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'temp',
        agentName: 'Temp',
        agentType: 'temp',
        content: '',
        status: 'running',
        blocks: [],
        initialPrompt: '',
      },
    ]
    const result = moveSpawnAgentBlock(blocks, 'temp', 'real')
    expect((result[0] as AgentContentBlock).agentId).toBe('real')
  })

  test('nests extracted block under parent when found', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'parent',
        agentName: 'Parent',
        agentType: 'parent',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'agent',
            agentId: 'temp',
            agentName: 'Temp',
            agentType: 'temp',
            content: '',
            status: 'running',
            blocks: [],
            initialPrompt: '',
          },
        ],
        initialPrompt: '',
      },
    ]
    const result = moveSpawnAgentBlock(blocks, 'temp', 'real', 'parent')
    const parent = result[0] as AgentContentBlock
    expect(parent.blocks).toHaveLength(1)
    expect((parent.blocks![0] as AgentContentBlock).agentId).toBe('real')
  })

  test('updates in place when parent missing to preserve order', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'temp',
        agentName: 'Temp',
        agentType: 'temp',
        content: '',
        status: 'running',
        blocks: [],
        initialPrompt: '',
      },
      { type: 'text', content: 'other' },
    ]
    const result = moveSpawnAgentBlock(blocks, 'temp', 'real', 'missing')
    // Block should stay in its original position (index 0), not move to end
    expect(result[0]).toMatchObject({ type: 'agent', agentId: 'real' })
    expect(result[1]).toMatchObject({ type: 'text', content: 'other' })
  })

  test('preserves block order when multiple agents resolve out of order', () => {
    // Simulate spawn_agents creating 3 placeholder blocks in order
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'toolcall-0',
        agentName: 'Agent A',
        agentType: 'scout',
        content: '',
        status: 'running',
        blocks: [],
        initialPrompt: '',
      },
      {
        type: 'agent',
        agentId: 'toolcall-1',
        agentName: 'Agent B',
        agentType: 'code-searcher',
        content: '',
        status: 'running',
        blocks: [],
        initialPrompt: '',
      },
      {
        type: 'agent',
        agentId: 'toolcall-2',
        agentName: 'Agent C',
        agentType: 'commander',
        content: '',
        status: 'running',
        blocks: [],
        initialPrompt: '',
      },
    ]

    // Agents resolve in different order: C first, then A, then B
    let result = moveSpawnAgentBlock(blocks, 'toolcall-2', 'real-c')
    result = moveSpawnAgentBlock(result, 'toolcall-0', 'real-a')
    result = moveSpawnAgentBlock(result, 'toolcall-1', 'real-b')

    // Order should be preserved: A, B, C
    expect(result[0]).toMatchObject({ agentId: 'real-a' })
    expect(result[1]).toMatchObject({ agentId: 'real-b' })
    expect(result[2]).toMatchObject({ agentId: 'real-c' })
  })
})
