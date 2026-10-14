import { describe, expect, test } from 'bun:test'

import {
  formatCompactionStatus,
  formatTokens,
  sidebarToolDisplayName,
} from '../right-sidebar-format'

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
      label: '✓ pruned −9k tokens',
      warning: false,
      band: 'green',
    })
    // A pruned pass that saved nothing still carries its percent band: the
    // band derives from `percentUsed` alone, never from `tokensSaved`
    // (regression guard for a mis-wired fallback that dropped the band).
    expect(
      formatCompactionStatus({
        phase: 'pruned',
        tokensSaved: 0,
        percentUsed: 41,
      }),
    ).toEqual({
      label: '✓ pruned −0 tokens',
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

// FID-2026-1010-005 — the tool naming matrix. Every tool label in the sidebar
// routes through `sidebarToolDisplayName` (renamed from `toolDisplayName` by
// FID-2026-1013-011 W2-1 so the repo's Title-Case `toolDisplayName` has one
// unambiguous owner), so these pins cover the mapped name, the sentence-case
// fallback, and the degenerate inputs.
describe('sidebarToolDisplayName (FID-2026-1010-005)', () => {
  test('a mapped identifier shows its matrix label', () => {
    expect(sidebarToolDisplayName('suggest_followups')).toBe('Suggest followup')
  })

  test('an unmapped identifier falls back to sentence case', () => {
    expect(sidebarToolDisplayName('read_file')).toBe('Read file')
    expect(sidebarToolDisplayName('web-search')).toBe('Web search')
  })

  test('an empty identifier shows the unknown-tool label, without throwing', () => {
    expect(sidebarToolDisplayName('')).toBe('Unknown tool')
  })

  test('a separator-only identifier shows the unknown-tool label', () => {
    expect(sidebarToolDisplayName('___')).toBe('Unknown tool')
  })

  test('a punctuation-only identifier shows the unknown-tool label', () => {
    expect(sidebarToolDisplayName('!!!')).toBe('Unknown tool')
  })

  test('a digit-bearing identifier is still humanized, not replaced', () => {
    expect(sidebarToolDisplayName('step_5_preview')).toBe('Step 5 preview')
  })
})

// FID-2026-1010-003 — the formatter's two operator-driven rules. Before this
// pass `formatTokens` had no unit pins of its own, so the changes shipped with
// nothing asserting them; these are the direct pins.
describe('formatTokens (FID-2026-1010-003)', () => {
  test('counts under 1000 stay bare — no unit, no separator', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(999)).toBe('999')
  })

  test('an exact thousand drops the trailing zero', () => {
    expect(formatTokens(1_000)).toBe('1k')
    expect(formatTokens(2_000)).toBe('2k')
    expect(formatTokens(100_000)).toBe('100k')
    expect(formatTokens(1_000_000)).toBe('1,000k')
  })

  test('thousands are grouped so the Cache row matches the Context row', () => {
    expect(formatTokens(1_200)).toBe('1.2k')
    expect(formatTokens(1_923_800)).toBe('1,923.8k')
    expect(formatTokens(2_265_500)).toBe('2,265.5k')
  })

  test('one decimal survives where it carries information', () => {
    expect(formatTokens(1_500)).toBe('1.5k')
    expect(formatTokens(12_345)).toBe('12.3k')
  })

  test('grouping is locale-pinned, not host-dependent', () => {
    // `toLocaleString` without a locale groups per the host ICU and would make
    // the sidebar's digits differ between environments; `Intl.NumberFormat`
    // with an explicit locale cannot.
    expect(formatTokens(1_000_000)).toContain(',')
  })
})
