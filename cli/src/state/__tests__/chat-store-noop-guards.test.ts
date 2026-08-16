import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../chat-store'

afterEach(() => {
  useChatStore.getState().reset()
})

describe('sidebar no-op guards (FID-2026-0815-008 F-11)', () => {
  test('updateContextTokens does not notify subscribers on an equal value', () => {
    let notifications = 0
    const unsubscribe = useChatStore.subscribe(() => {
      notifications++
    })
    try {
      useChatStore.getState().updateContextTokens(100)
      const afterFirst = notifications
      useChatStore.getState().updateContextTokens(100) // no-op
      expect(notifications).toBe(afterFirst)
      useChatStore.getState().updateContextTokens(200) // real change
      expect(notifications).toBe(afterFirst + 1)
    } finally {
      unsubscribe()
    }
  })

  test('setCompactionStatus no-ops on a shallow-equal status (fresh object)', () => {
    let notifications = 0
    const unsubscribe = useChatStore.subscribe(() => {
      notifications++
    })
    try {
      useChatStore.getState().setCompactionStatus({ phase: 'compacting' })
      const afterFirst = notifications
      // Fresh object reference, equal fields — must not notify.
      useChatStore.getState().setCompactionStatus({ phase: 'compacting' })
      expect(notifications).toBe(afterFirst)
    } finally {
      unsubscribe()
    }
  })

  test('updateSessionCost and updateContextTokensMax no-op on equal values', () => {
    let notifications = 0
    const unsubscribe = useChatStore.subscribe(() => {
      notifications++
    })
    try {
      useChatStore.getState().updateSessionCost(42)
      useChatStore.getState().updateContextTokensMax(262_144)
      const afterFirst = notifications
      useChatStore.getState().updateSessionCost(42)
      useChatStore.getState().updateContextTokensMax(262_144)
      expect(notifications).toBe(afterFirst)
    } finally {
      unsubscribe()
    }
  })
})
