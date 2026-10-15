import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../../chat-store'

afterEach(() => {
  // The fold is a UI preference that survives session resets — reset it
  // manually here so tests never leak state into each other.
  useChatStore.getState().setSidebarCollapsed(false)
})

describe('sidebar manual fold (FID-2026-0816-010 follow-up)', () => {
  test('sidebarCollapsed defaults to false (expanded)', () => {
    expect(useChatStore.getState().sidebarCollapsed).toBe(false)
  })

  test('setSidebarCollapsed stores the fold state', () => {
    useChatStore.getState().setSidebarCollapsed(true)
    expect(useChatStore.getState().sidebarCollapsed).toBe(true)
    useChatStore.getState().setSidebarCollapsed(false)
    expect(useChatStore.getState().sidebarCollapsed).toBe(false)
  })

  test('session reset does NOT clear the manual fold (UI preference persists)', () => {
    useChatStore.getState().setSidebarCollapsed(true)
    useChatStore.getState().reset()
    expect(useChatStore.getState().sidebarCollapsed).toBe(true)
  })
})
