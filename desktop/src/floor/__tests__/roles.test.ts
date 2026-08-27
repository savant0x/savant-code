import { describe, expect, test } from 'bun:test'

import { DECK_TOKENS } from '../deck-tokens.generated'
import { castAgent, DECK_ROLE_IDS, GENERIC_ROLE_ID, roleAccent } from '../roles'

describe('deck role registry parity (FID-2026-0822-012 P2)', () => {
  test('the cast list equals the canonical 10-role ECHO roster exactly', () => {
    expect([...DECK_ROLE_IDS]).toEqual([
      'savant',
      'detective',
      'forge',
      'verifier',
      'recorder',
      'thinker',
      'scout',
      'researcher',
      'scribe',
      'adversary',
    ])
    // The silhouette is not a roster member — it is the absence of one.
    expect(DECK_ROLE_IDS).not.toContain(GENERIC_ROLE_ID)
  })
})

describe('deck walker casting (FID-2026-0822-012 P2)', () => {
  test('exact agentType wins over everything', () => {
    expect(castAgent('detective', 'Totally Different')).toBe('detective')
    expect(castAgent('  Forge  ', undefined)).toBe('forge')
  })

  test('persona display names resolve to their specialist role', () => {
    expect(castAgent(undefined, 'Savant the Thinker')).toBe('thinker')
    expect(castAgent(undefined, 'Savant the Adversary')).toBe('adversary')
    expect(castAgent(undefined, 'Detective')).toBe('detective')
  })

  test('the bare orchestrator name casts savant', () => {
    expect(castAgent(undefined, 'Savant')).toBe('savant')
    expect(castAgent(undefined, 'SAVANT')).toBe('savant')
  })

  test('unknown identities render the generic silhouette — never invented', () => {
    expect(castAgent('mystery-bot', 'Mystery Bot')).toBe(GENERIC_ROLE_ID)
    expect(castAgent(undefined, undefined)).toBe(GENERIC_ROLE_ID)
    expect(castAgent('', '   ')).toBe(GENERIC_ROLE_ID)
  })
})

describe('deck role accents (FID-2026-0822-012 P2)', () => {
  test('every accent is a generated contract token value — zero raw hex', () => {
    const palette = new Set<string>(Object.values(DECK_TOKENS))
    for (const id of DECK_ROLE_IDS) {
      expect(palette.has(roleAccent(id))).toBe(true)
    }
    expect(palette.has(roleAccent(GENERIC_ROLE_ID))).toBe(true)
  })

  test('the silhouette renders muted', () => {
    expect(roleAccent(GENERIC_ROLE_ID)).toBe(DECK_TOKENS.muted)
  })
})
