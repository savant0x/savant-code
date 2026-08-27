import { describe, expect, test } from 'bun:test'

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
})
