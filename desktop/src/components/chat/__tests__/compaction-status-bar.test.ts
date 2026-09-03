import { describe, expect, test } from 'bun:test'

import { formatTokens } from '../CompactionStatusBar'

import type { CompactionStatus } from '../../../state/transcript-store'

describe('compaction status payloads', () => {
  test('supports warning and blocked lifecycle payloads', () => {
    const warning: CompactionStatus = {
      type: 'compaction_status',
      phase: 'warning',
      percentUsed: 91,
    }
    const blocked: CompactionStatus = {
      type: 'compaction_status',
      phase: 'blocked',
      blockReason: 'circuit-breaker-open',
    }
    expect(warning.phase).toBe('warning')
    expect(blocked.blockReason).toBe('circuit-breaker-open')
  })

  test('accepts absolute token counts for the window tracker (P4)', () => {
    const idle: CompactionStatus = {
      type: 'compaction_status',
      phase: 'idle',
      percentUsed: 42,
      contextTokens: 84192,
      windowTokens: 200000,
    }
    expect(idle.contextTokens).toBe(84192)
    expect(idle.windowTokens).toBe(200000)
    // The fields stay optional — older emitters without them are still valid.
    const legacy: CompactionStatus = {
      type: 'compaction_status',
      phase: 'idle',
      percentUsed: 42,
    }
    expect(legacy.contextTokens).toBeUndefined()
  })
})

describe('formatTokens', () => {
  test('formats thousands as k with no decimals', () => {
    expect(formatTokens(84192)).toBe('84k')
    expect(formatTokens(200000)).toBe('200k')
    expect(formatTokens(999)).toBe('999')
    expect(formatTokens(1000)).toBe('1k')
  })
})
