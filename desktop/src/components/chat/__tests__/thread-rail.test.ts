import { describe, expect, test } from 'bun:test'

import { orderWorkspaceThreads } from '../ThreadRail'

describe('workspace thread ordering', () => {
  test('pinned threads precede unread, then read threads', () => {
    const base = {
      agentId: 'orchestrator',
      messages: [],
    }
    const ordered = orderWorkspaceThreads([
      {
        ...base,
        sessionId: 's-read',
        chatId: 'read',
        unread: false,
        pinned: false,
      },
      {
        ...base,
        sessionId: 's-unread',
        chatId: 'unread',
        unread: true,
        pinned: false,
      },
      {
        ...base,
        sessionId: 's-pinned',
        chatId: 'pinned',
        unread: false,
        pinned: true,
      },
    ])
    expect(ordered.map((thread) => thread.chatId)).toEqual([
      'pinned',
      'unread',
      'read',
    ])
  })
})
