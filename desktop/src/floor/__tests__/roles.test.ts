import { describe, expect, test } from 'bun:test'

import { DECK_ACCENTS } from '../deck-accents'
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

describe('deck role accents (FID-2026-0828-002 floor palette)', () => {
  test('cast accents come from the desaturated FLOOR palette, never raw tokens', () => {
    // FID-2026-0828-002: raw contract tokens saturated under the deck's
    // additive/emissive pipeline (the operator's cyan/yellow floor wash), so
    // the cast now reads from deck-accents.ts. The floor palette values are
    // intentionally NOT contract tokens — that is the whole point.
    const rawTokens = new Set<string>(Object.values(DECK_TOKENS))
    const floorPalette = new Set<string>(Object.values(DECK_ACCENTS))
    for (const id of DECK_ROLE_IDS) {
      const accent = roleAccent(id)
      expect(floorPalette.has(accent)).toBe(true)
      expect(rawTokens.has(accent)).toBe(false)
    }
  })

  test('every cast role has a distinct accent (FID-2026-0828-002 B)', () => {
    // v1 collisions (scout≡researcher≡savant, scribe≡thinker) were split so
    // all 10 roles are visually separable on the floor.
    const accents = DECK_ROLE_IDS.map((id) => roleAccent(id))
    expect(new Set(accents).size).toBe(DECK_ROLE_IDS.length)
  })

  test('the silhouette renders muted', () => {
    expect(roleAccent(GENERIC_ROLE_ID)).toBe(DECK_TOKENS.muted)
  })

  test('every cast role has a visually distinct accent (FID-2026-0828-002 B)', () => {
    // The old palette collided scout/researcher ≡ savant and scribe ≡ thinker,
    // so half the cast shared colors even with a correct material recipe.
    const accents = DECK_ROLE_IDS.map((id) => roleAccent(id))
    expect(new Set(accents).size).toBe(DECK_ROLE_IDS.length)
  })
})
