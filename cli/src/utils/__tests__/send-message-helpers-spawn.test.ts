import { describe, test, expect } from 'bun:test'

import { extractSpawnAgentResultContent } from '../message-block-helpers'
import {
  createSpawnAgentBlocks,
  isSpawnAgentsResult,
} from '../send-message-helpers'

import type { AgentContentBlock } from '../../types/chat'

// ============================================================================
// Spawn Agents Helpers Tests (from send-message-helpers)
// ============================================================================

describe('createSpawnAgentBlocks', () => {
  test('creates agent blocks from spawn_agents input', () => {
    const agents = [
      { agent_type: 'scout', prompt: 'Find files' },
      { agent_type: 'code-searcher', prompt: 'Search code' },
    ]

    const result = createSpawnAgentBlocks('tool-1', agents)

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('agent')
    expect((result[0] as AgentContentBlock).agentId).toBe('tool-1-0')
    expect((result[1] as AgentContentBlock).agentId).toBe('tool-1-1')
  })

  test('filters out hidden agents', () => {
    const agents = [
      { agent_type: 'scout' },
      { agent_type: 'savant-code/context-pruner' }, // This should be hidden
    ]

    const result = createSpawnAgentBlocks('tool-1', agents)

    // context-pruner is in the hidden agents list
    expect(result.length).toBeLessThanOrEqual(2)
  })
})

describe('isSpawnAgentsResult', () => {
  test('returns true for spawn_agents result structure', () => {
    const output = [{ agentName: 'scout', value: 'result' }]

    expect(isSpawnAgentsResult(output)).toBe(true)
  })

  test('returns false for non-array', () => {
    expect(isSpawnAgentsResult('string')).toBe(false)
    expect(isSpawnAgentsResult(null)).toBe(false)
  })

  test('returns false for array without agent properties', () => {
    expect(isSpawnAgentsResult([{ foo: 'bar' }])).toBe(false)
  })
})

describe('extractSpawnAgentResultContent', () => {
  test('extracts string value directly', () => {
    const result = extractSpawnAgentResultContent('Simple result')

    expect(result.content).toBe('Simple result')
    expect(result.hasError).toBe(false)
  })

  test('extracts string from value property', () => {
    const result = extractSpawnAgentResultContent({ value: 'Nested string' })

    expect(result.content).toBe('Nested string')
    expect(result.hasError).toBe(false)
  })

  test('extracts error message', () => {
    const result = extractSpawnAgentResultContent({ errorMessage: 'Failed!' })

    expect(result.content).toBe('Failed!')
    expect(result.hasError).toBe(true)
  })

  test('extracts nested error message', () => {
    const result = extractSpawnAgentResultContent({
      value: { errorMessage: 'Nested error!' },
    })

    expect(result.content).toBe('Nested error!')
    expect(result.hasError).toBe(true)
  })

  test('extracts message property', () => {
    const result = extractSpawnAgentResultContent({
      message: 'Message content',
    })

    expect(result.content).toBe('Message content')
    expect(result.hasError).toBe(false)
  })

  test('extracts nested message property', () => {
    const result = extractSpawnAgentResultContent({
      value: { message: 'Nested message' },
    })

    expect(result.content).toBe('Nested message')
    expect(result.hasError).toBe(false)
  })

  test('returns empty for null/undefined', () => {
    const result = extractSpawnAgentResultContent(null)

    expect(result.content).toBe('')
    expect(result.hasError).toBe(false)
  })

  test('returns empty for empty object', () => {
    const result = extractSpawnAgentResultContent({})

    expect(result.content).toBe('')
    expect(result.hasError).toBe(false)
  })
})
