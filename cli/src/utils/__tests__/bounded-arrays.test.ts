import { describe, expect, test } from 'bun:test'

import { trimAgentStack, trimToolsUsed } from '../bounded-arrays'

import type { AgentStackEntry } from '../../state/chat-store'

describe('trimAgentStack', () => {
  test('returns the stack unchanged when under the cap', () => {
    const stack: AgentStackEntry[] = [{ id: 'a', isActive: false }]
    expect(trimAgentStack(stack)).toEqual(stack)
  })

  test('drops the oldest inactive entries beyond the cap', () => {
    const stack: AgentStackEntry[] = Array.from({ length: 5 }, (_, i) => ({
      id: `a${i}`,
      isActive: false,
    }))
    const trimmed = trimAgentStack(stack, 3)
    expect(trimmed.map((e) => e.id)).toEqual(['a2', 'a3', 'a4'])
  })

  test('preserves every active entry even when the cap would drop them', () => {
    const stack: AgentStackEntry[] = [
      { id: 'old-inactive', isActive: false },
      { id: 'live-1', isActive: true },
      { id: 'live-2', isActive: true },
      { id: 'new-inactive', isActive: false },
    ]
    const trimmed = trimAgentStack(stack, 2)
    expect(trimmed.map((e) => e.id)).toEqual(['live-1', 'live-2'])
  })

  test('keeps active entries plus the newest inactive when capacity allows', () => {
    const stack: AgentStackEntry[] = [
      { id: 'old-inactive', isActive: false },
      { id: 'live-1', isActive: true },
      { id: 'new-inactive', isActive: false },
    ]
    const trimmed = trimAgentStack(stack, 2)
    expect(trimmed.map((e) => e.id)).toEqual(['live-1', 'new-inactive'])
  })
})

describe('trimToolsUsed', () => {
  test('returns the list unchanged when under the cap', () => {
    expect(trimToolsUsed(['a', 'b'])).toEqual(['a', 'b'])
  })

  test('drops the oldest tool names beyond the cap', () => {
    expect(trimToolsUsed(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd'])
  })
})
