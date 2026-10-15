import { describe, expect, test } from 'bun:test'

import {
  getImplementorDisplayName,
  getImplementorIndex,
  isImplementorAgent,
} from '../implementor-helpers'

import type { AgentContentBlock, ContentBlock } from '../../types/chat'

describe('isImplementorAgent', () => {
  test('identifies implementor agents', () => {
    expect(
      isImplementorAgent({ agentType: 'editor-implementor', blocks: [] }),
    ).toBe(true)
    expect(
      isImplementorAgent({ agentType: 'editor-implementor-opus', blocks: [] }),
    ).toBe(true)
    expect(
      isImplementorAgent({ agentType: 'editor-implementor-gpt-5', blocks: [] }),
    ).toBe(true)
    expect(
      isImplementorAgent({ agentType: 'editor-implementor2', blocks: [] }),
    ).toBe(true)
  })

  test('rejects non-implementor agents', () => {
    expect(isImplementorAgent({ agentType: 'scout', blocks: [] })).toBe(false)
    expect(isImplementorAgent({ agentType: 'commander', blocks: [] })).toBe(
      false,
    )
    expect(
      isImplementorAgent({ agentType: 'best-of-n-selector', blocks: [] }),
    ).toBe(false)
  })
})

describe('getImplementorDisplayName', () => {
  test('returns model names', () => {
    expect(getImplementorDisplayName('editor-implementor')).toBe('Sonnet')
    expect(getImplementorDisplayName('editor-implementor-opus')).toBe('Opus')
    expect(getImplementorDisplayName('editor-implementor-gpt-5')).toBe('GPT-5')
    expect(getImplementorDisplayName('editor-implementor-gemini')).toBe(
      'Gemini',
    )
  })

  test('adds index when provided', () => {
    expect(getImplementorDisplayName('editor-implementor', 0)).toBe('Sonnet #1')
    expect(getImplementorDisplayName('editor-implementor-opus', 2)).toBe(
      'Opus #3',
    )
  })
})

describe('getImplementorIndex', () => {
  test('returns index among same-type siblings', () => {
    const agent1 = {
      type: 'agent',
      agentId: 'a1',
      agentName: 'Impl 1',
      agentType: 'editor-implementor',
      content: '',
      status: 'complete',
      blocks: [],
    } as AgentContentBlock
    const agent2 = {
      type: 'agent',
      agentId: 'a2',
      agentName: 'Impl 2',
      agentType: 'editor-implementor',
      content: '',
      status: 'complete',
      blocks: [],
    } as AgentContentBlock
    const agent3 = {
      type: 'agent',
      agentId: 'a3',
      agentName: 'Impl 3',
      agentType: 'editor-implementor-opus',
      content: '',
      status: 'complete',
      blocks: [],
    } as AgentContentBlock
    const siblings: ContentBlock[] = [agent1, agent2, agent3]

    expect(getImplementorIndex(agent1, siblings)).toBe(0)
    expect(getImplementorIndex(agent2, siblings)).toBe(1)
    expect(getImplementorIndex(agent3, siblings)).toBeUndefined()
  })

  test('returns undefined for non-implementor', () => {
    const filePicker = {
      type: 'agent',
      agentId: 'fp1',
      agentName: 'File Picker',
      agentType: 'scout',
      content: '',
      status: 'complete',
      blocks: [],
    } as AgentContentBlock
    const siblings: ContentBlock[] = [filePicker]

    expect(getImplementorIndex(filePicker, siblings)).toBeUndefined()
  })
})
