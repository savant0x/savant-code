import { describe, expect, test } from 'bun:test'

import {
  groupConsecutiveImplementors,
  groupConsecutiveNonImplementorAgents,
} from '../implementor-helpers'

import type {
  AgentContentBlock,
  ContentBlock,
  TextContentBlock,
} from '../../types/chat'

describe('groupConsecutiveImplementors', () => {
  const createImplementorAgent = (
    id: string,
    agentType = 'editor-implementor',
  ): AgentContentBlock =>
    ({
      type: 'agent',
      agentId: id,
      agentName: 'Implementor',
      agentType,
      content: '',
      status: 'complete',
      blocks: [],
    }) as AgentContentBlock

  const createNonImplementorAgent = (
    id: string,
    agentType: string,
  ): AgentContentBlock =>
    ({
      type: 'agent',
      agentId: id,
      agentName: agentType,
      agentType,
      content: '',
      status: 'complete',
      blocks: [],
    }) as AgentContentBlock

  const createTextBlock = (content: string): TextContentBlock =>
    ({
      type: 'text',
      content,
    }) as TextContentBlock

  test('groups consecutive implementor agents', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1'),
      createImplementorAgent('impl-2', 'editor-implementor-opus'),
      createImplementorAgent('impl-3', 'editor-implementor-gpt-5'),
      createNonImplementorAgent('fp-1', 'scout'),
    ]
    const result = groupConsecutiveImplementors(blocks, 0)

    expect(result.group).toHaveLength(3)
    expect(result.group[0].agentId).toBe('impl-1')
    expect(result.group[1].agentId).toBe('impl-2')
    expect(result.group[2].agentId).toBe('impl-3')
    expect(result.nextIndex).toBe(3)
  })

  test('stops at non-implementor agent', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1'),
      createNonImplementorAgent('cmd-1', 'commander'),
      createImplementorAgent('impl-2'),
    ]
    const result = groupConsecutiveImplementors(blocks, 0)

    expect(result.group).toHaveLength(1)
    expect(result.nextIndex).toBe(1)
  })

  test('stops at non-agent block', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1'),
      createTextBlock('some text'),
      createImplementorAgent('impl-2'),
    ]
    const result = groupConsecutiveImplementors(blocks, 0)

    expect(result.group).toHaveLength(1)
    expect(result.nextIndex).toBe(1)
  })

  test('returns empty group when starting at non-implementor', () => {
    const blocks: ContentBlock[] = [
      createNonImplementorAgent('fp-1', 'scout'),
      createImplementorAgent('impl-1'),
    ]
    const result = groupConsecutiveImplementors(blocks, 0)

    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(0)
  })

  test('handles agents with proposed tools as implementors', () => {
    const agentWithProposedTools: AgentContentBlock = {
      type: 'agent',
      agentId: 'custom-1',
      agentName: 'Custom Agent',
      agentType: 'custom-agent',
      content: '',
      status: 'complete',
      blocks: [
        {
          type: 'tool',
          toolCallId: 'tool-1',
          toolName: 'propose_str_replace',
          input: {},
        },
      ],
    } as AgentContentBlock

    const blocks: ContentBlock[] = [
      agentWithProposedTools,
      createImplementorAgent('impl-1'),
    ]
    const result = groupConsecutiveImplementors(blocks, 0)

    expect(result.group).toHaveLength(2)
    expect(result.group[0].agentId).toBe('custom-1')
    expect(result.group[1].agentId).toBe('impl-1')
  })

  test('handles empty blocks array', () => {
    const result = groupConsecutiveImplementors([], 0)
    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(0)
  })
})

describe('groupConsecutiveNonImplementorAgents', () => {
  const createImplementorAgent = (id: string): AgentContentBlock =>
    ({
      type: 'agent',
      agentId: id,
      agentName: 'Implementor',
      agentType: 'editor-implementor',
      content: '',
      status: 'complete',
      blocks: [],
    }) as AgentContentBlock

  const createNonImplementorAgent = (
    id: string,
    agentType: string,
  ): AgentContentBlock =>
    ({
      type: 'agent',
      agentId: id,
      agentName: agentType,
      agentType,
      content: '',
      status: 'complete',
      blocks: [],
    }) as AgentContentBlock

  const createTextBlock = (content: string): TextContentBlock =>
    ({
      type: 'text',
      content,
    }) as TextContentBlock

  test('groups consecutive non-implementor agents', () => {
    const blocks: ContentBlock[] = [
      createNonImplementorAgent('fp-1', 'scout'),
      createNonImplementorAgent('cmd-1', 'commander'),
      createNonImplementorAgent('cs-1', 'code-searcher'),
      createImplementorAgent('impl-1'),
    ]
    const result = groupConsecutiveNonImplementorAgents(blocks, 0)

    expect(result.group).toHaveLength(3)
    expect(result.group[0].agentType).toBe('scout')
    expect(result.group[1].agentType).toBe('commander')
    expect(result.group[2].agentType).toBe('code-searcher')
    expect(result.nextIndex).toBe(3)
  })

  test('stops at implementor agent', () => {
    const blocks: ContentBlock[] = [
      createNonImplementorAgent('fp-1', 'scout'),
      createImplementorAgent('impl-1'),
      createNonImplementorAgent('cmd-1', 'commander'),
    ]
    const result = groupConsecutiveNonImplementorAgents(blocks, 0)

    expect(result.group).toHaveLength(1)
    expect(result.nextIndex).toBe(1)
  })

  test('stops at non-agent block', () => {
    const blocks: ContentBlock[] = [
      createNonImplementorAgent('fp-1', 'scout'),
      createTextBlock('some text'),
      createNonImplementorAgent('cmd-1', 'commander'),
    ]
    const result = groupConsecutiveNonImplementorAgents(blocks, 0)

    expect(result.group).toHaveLength(1)
    expect(result.nextIndex).toBe(1)
  })

  test('returns empty group when starting at implementor', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1'),
      createNonImplementorAgent('fp-1', 'scout'),
    ]
    const result = groupConsecutiveNonImplementorAgents(blocks, 0)

    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(0)
  })

  test('returns empty group when starting at text block', () => {
    const blocks: ContentBlock[] = [
      createTextBlock('some text'),
      createNonImplementorAgent('fp-1', 'scout'),
    ]
    const result = groupConsecutiveNonImplementorAgents(blocks, 0)

    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(0)
  })

  test('groups from middle of array', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1'),
      createNonImplementorAgent('fp-1', 'scout'),
      createNonImplementorAgent('cmd-1', 'commander'),
      createTextBlock('done'),
    ]
    const result = groupConsecutiveNonImplementorAgents(blocks, 1)

    expect(result.group).toHaveLength(2)
    expect(result.group[0].agentType).toBe('scout')
    expect(result.group[1].agentType).toBe('commander')
    expect(result.nextIndex).toBe(3)
  })

  test('handles mixed agent types', () => {
    const blocks: ContentBlock[] = [
      createNonImplementorAgent('fp-1', 'scout'),
      createNonImplementorAgent('think-1', 'thinker'),
      createNonImplementorAgent('rev-1', 'verifier'),
    ]
    const result = groupConsecutiveNonImplementorAgents(blocks, 0)

    expect(result.group).toHaveLength(3)
    expect(result.nextIndex).toBe(3)
  })

  test('handles empty blocks array', () => {
    const result = groupConsecutiveNonImplementorAgents([], 0)
    expect(result.group).toHaveLength(0)
    expect(result.nextIndex).toBe(0)
  })
})
