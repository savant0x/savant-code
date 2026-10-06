// FID-2026-1005-010 — the reusable free marker: one predicate + one display
// prefix so every free-options surface applies the same rule ("free" in the
// name/id, or from a free-key provider).
import { describe, expect, test } from 'bun:test'

import {
  FREE_BADGE,
  FREE_KEY_PROVIDERS,
  freeBadgeFor,
  isFreeTierEntry,
} from '../free-badge'

describe('free marker (FID-2026-1005-010)', () => {
  test('flags "free" in the name or id, case-insensitive', () => {
    expect(isFreeTierEntry({ name: 'GPT 5.6 Free' })).toBe(true)
    expect(isFreeTierEntry({ id: 'gw/free-mini' })).toBe(true)
    expect(isFreeTierEntry({ name: 'FREE for all' })).toBe(true)
    expect(
      isFreeTierEntry({ id: 'openai/gpt-5.6-sol', name: 'GPT 5.6 Sol' }),
    ).toBe(false)
  })

  test('flags every entry from a free-key provider regardless of name', () => {
    expect(
      isFreeTierEntry({
        id: 'chatanywhere/gpt-5.6-sol',
        name: 'GPT 5.6 Sol',
        provider: 'chatanywhere',
      }),
    ).toBe(true)
    expect(FREE_KEY_PROVIDERS).toEqual([
      { provider: 'chatanywhere', envVar: 'CHATANYWHERE_API_KEY' },
    ])
  })

  test('honors an explicit freeTier flag', () => {
    expect(isFreeTierEntry({ name: 'Anything', freeTier: true })).toBe(true)
    expect(isFreeTierEntry({ name: 'Anything', freeTier: false })).toBe(false)
  })

  test('freeBadgeFor is a drop-in prefix', () => {
    expect(freeBadgeFor({ name: 'Free Mini' })).toBe(`${FREE_BADGE} `)
    expect(
      freeBadgeFor({ id: 'openai/gpt-5.6-sol', name: 'GPT 5.6 Sol' }),
    ).toBe('')
    expect(`${freeBadgeFor({ name: 'Free Mini' })}Free Mini`).toBe(
      '⭐ Free Mini',
    )
  })
})
