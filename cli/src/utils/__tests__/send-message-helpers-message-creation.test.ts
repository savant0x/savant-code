import { describe, test, expect } from 'bun:test'

import {
  createModeDividerMessage,
  createAiMessageShell,
  createErrorMessage,
  generateAiMessageId,
} from '../send-message-helpers'

import type { ModeDividerContentBlock } from '../../types/chat'

// ============================================================================
// Message Creation Helpers Tests (from send-message-helpers)
// ============================================================================

describe('createModeDividerMessage', () => {
  test('creates a mode divider message', () => {
    const message = createModeDividerMessage('SCAFFOLD')

    expect(message.variant).toBe('ai')
    expect(message.content).toBe('')
    expect(message.blocks).toHaveLength(1)
    expect(message.blocks![0].type).toBe('mode-divider')
    expect((message.blocks![0] as ModeDividerContentBlock).mode).toBe(
      'SCAFFOLD',
    )
    expect(message.id).toMatch(/^divider-/)
  })
})

describe('createAiMessageShell', () => {
  test('creates an empty AI message shell', () => {
    const message = createAiMessageShell('ai-123')

    expect(message.id).toBe('ai-123')
    expect(message.variant).toBe('ai')
    expect(message.content).toBe('')
    expect(message.blocks).toEqual([])
    expect(message.metadata?.allowInlineAds).toBe(true)
  })
})

describe('createErrorMessage', () => {
  test('creates an error message', () => {
    const message = createErrorMessage('Something went wrong')

    expect(message.variant).toBe('error')
    expect(message.content).toBe('Something went wrong')
    expect(message.id).toMatch(/^error-/)
  })
})

describe('generateAiMessageId', () => {
  test('generates unique IDs', () => {
    const id1 = generateAiMessageId()
    const id2 = generateAiMessageId()

    expect(id1).toMatch(/^ai-\d+-[a-f0-9]+$/)
    expect(id1).not.toBe(id2)
  })
})
