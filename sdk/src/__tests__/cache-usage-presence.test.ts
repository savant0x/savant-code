// FID-2026-1007-009 — the SDK normalization boundary must not erase whether a
// provider reported cached tokens. `cachedInputTokens` is still coerced to 0 so
// the shape stays stable for existing consumers, but the coercion alone made a
// reported cache miss indistinguishable from a provider that does not report
// caching at all — and the CLI sidebar renders those two differently.
import { describe, expect, test } from 'bun:test'

import { emitCacheDebugUsage } from '../impl/llm/usage'

import type { CacheDebugUsageData } from '@savant-code/common/types/contracts/llm'

const capture = (usage: {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cachedInputTokens?: number
}): CacheDebugUsageData => {
  let seen: CacheDebugUsageData | undefined
  emitCacheDebugUsage({
    callback: (emitted) => {
      seen = emitted as CacheDebugUsageData
    },
    usage,
  })
  if (seen === undefined) throw new Error('usage callback never fired')
  return seen
}

describe('cache usage presence at the SDK boundary (FID-2026-1007-009)', () => {
  test('a provider-reported zero stays a known value', () => {
    const emitted = capture({
      inputTokens: 900,
      outputTokens: 12,
      totalTokens: 912,
      cachedInputTokens: 0,
    })
    expect(emitted.cachedInputTokens).toBe(0)
    expect(emitted.cachedInputTokensReported).toBe(true)
  })

  test('an omitted cache field stays unknown instead of becoming a zero', () => {
    const emitted = capture({ inputTokens: 900, outputTokens: 12 })
    // The legacy coercion still happens for shape stability...
    expect(emitted.cachedInputTokens).toBe(0)
    // ...but the fact that nothing was reported survives it.
    expect(emitted.cachedInputTokensReported).toBe(false)
  })

  test('a positive count is reported and unchanged', () => {
    const emitted = capture({
      inputTokens: 1_000,
      outputTokens: 4,
      totalTokens: 1_004,
      cachedInputTokens: 768,
    })
    expect(emitted.cachedInputTokens).toBe(768)
    expect(emitted.cachedInputTokensReported).toBe(true)
  })

  test('an absent callback is inert', () => {
    expect(() => emitCacheDebugUsage({ usage: {} })).not.toThrow()
  })
})
