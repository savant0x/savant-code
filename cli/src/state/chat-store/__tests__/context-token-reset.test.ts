import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../../chat-store'

afterEach(() => {
  // Restore the store's initial meter state so tests never leak state.
  useChatStore.getState().resetContextTokens()
  useChatStore.getState().updateContextTokensMax(200_000)
})

describe('resetContextTokens (FID-2026-1009-002)', () => {
  test('zeroes the used-count and preserves the cap', () => {
    useChatStore.getState().updateContextTokens(45_000)
    useChatStore.getState().updateContextTokensMax(1_000_000)
    useChatStore.getState().resetContextTokens()
    expect(useChatStore.getState().contextTokensUsed).toBe(0)
    // The cap is owned by the resolved model window and must survive a
    // chat clear — /new shows 0/1,000,000, not the fallback readout.
    expect(useChatStore.getState().contextTokensMax).toBe(1_000_000)
  })

  test('is a no-op on an already-zero meter', () => {
    useChatStore.getState().resetContextTokens()
    expect(useChatStore.getState().contextTokensUsed).toBe(0)
  })

  test('the meter can be re-seeded after a reset (boot/resume path)', () => {
    useChatStore.getState().updateContextTokens(45_000)
    useChatStore.getState().resetContextTokens()
    useChatStore.getState().updateContextTokens(45_000)
    expect(useChatStore.getState().contextTokensUsed).toBe(45_000)
  })
})
