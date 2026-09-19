import { describe, expect, test } from 'bun:test'

import { formatCompactionStatus } from '../right-sidebar-format'

describe('formatCompactionStatus (FID-2026-0919-017 A2: no orphaned outcomes)', () => {
  test('warning labels the live threshold percent with its band', () => {
    expect(
      formatCompactionStatus({ phase: 'warning', percentUsed: 87 }),
    ).toEqual({
      label: '⚠ 87% of window',
      warning: true,
      band: 'orange',
    })
  })

  test('blocked labels the block reason instead of falling through to idle', () => {
    expect(
      formatCompactionStatus({
        phase: 'blocked',
        percentUsed: 91,
        blockReason: 'escalation-hold',
      }),
    ).toEqual({
      label: '⛔ blocked (escalation-hold)',
      warning: true,
      band: 'orange',
    })
  })

  test('blocked without a reason labels unknown', () => {
    expect(formatCompactionStatus({ phase: 'blocked' })).toEqual({
      label: '⛔ blocked (unknown)',
      warning: true,
      band: 'green',
    })
  })

  test('ineffective labels the failed pruner pass instead of falling through to idle', () => {
    expect(
      formatCompactionStatus({ phase: 'ineffective', percentUsed: 93 }),
    ).toEqual({
      label: '⚠ pruner ineffective — context still over trigger',
      warning: true,
      band: 'orange',
    })
  })

  test('micro-compact and pruned outcomes keep their distinct labels', () => {
    expect(
      formatCompactionStatus({ phase: 'compacted', tokensSaved: 850 }),
    ).toEqual({
      label: '✓ micro −850 tokens',
      warning: false,
      band: 'green',
    })
    expect(
      formatCompactionStatus({
        phase: 'pruned',
        tokensSaved: 9_000,
        percentUsed: 41,
      }),
    ).toEqual({
      label: '✓ pruned −9.0k tokens',
      warning: false,
      band: 'green',
    })
  })

  test('compacting keeps its label', () => {
    expect(formatCompactionStatus({ phase: 'compacting' })).toEqual({
      label: 'compacting…',
      warning: false,
    })
  })
})
