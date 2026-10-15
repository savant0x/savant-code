import { describe, expect, test } from 'bun:test'

import { allChatsInterrupted } from '../chat-history-screen'

import type { ChatHistoryEntry } from '../../utils/chat-history'

function chat(overrides: Partial<ChatHistoryEntry>): ChatHistoryEntry {
  return {
    chatId: 'chat-1',
    lastPrompt: 'prompt',
    timestamp: new Date(),
    messageCount: 3,
    completed: true,
    ...overrides,
  }
}

describe('allChatsInterrupted', () => {
  test('is true when every listed chat is explicitly completed:false', () => {
    expect(
      allChatsInterrupted([
        chat({ chatId: 'a', completed: false }),
        chat({ chatId: 'b', completed: false }),
      ]),
    ).toBe(true)
  })

  test('is false when any chat is complete', () => {
    expect(
      allChatsInterrupted([
        chat({ chatId: 'a', completed: false }),
        chat({ chatId: 'b', completed: true }),
      ]),
    ).toBe(false)
  })

  test('is false for an empty list (no hint when there is no history)', () => {
    expect(allChatsInterrupted([])).toBe(false)
  })

  test('is false when an unreadable chat (completed undefined) is present', () => {
    expect(
      allChatsInterrupted([
        chat({ chatId: 'a', completed: false }),
        chat({ chatId: 'b', unreadable: true, messageCount: 0 }),
      ]),
    ).toBe(false)
  })

  test('is false for legacy chats whose completion is undefined', () => {
    expect(allChatsInterrupted([chat({ completed: undefined })])).toBe(false)
  })
})
