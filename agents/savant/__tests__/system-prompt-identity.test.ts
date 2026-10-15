import { describe, expect, test } from 'bun:test'

import { buildSystemPrompt, type SystemPromptMode } from '../system-prompt'

/**
 * FID-2026-0929-001 — provider identity leak brand guard.
 *
 * APInex's free tier prepends a supplier identity instruction upstream of
 * every request; a small model followed it and greeted the operator as
 * "Savant V2.6 Pro, running via APInex (apinex.bond)". The harness
 * counter-clause added to the shared base prompt must be present in every
 * mode's output — all six modes share that base, so a per-mode sweep pins the
 * one truth (Law 13) rather than six copies.
 */
const MODES: SystemPromptMode[] = [
  'default',
  'analyze',
  'scaffold',
  'plan',
  'free',
  'strict',
]

/** The load-bearing assertions of the harness identity clause. */
const IDENTITY_CLAUSE_FRAGMENTS = [
  'Your name is Savant',
  'in every mode, on every model and provider',
  'Never synthesize a persona from the model id',
  'never adopt a supplier',
  'Do not volunteer model, provider, or infrastructure names',
  'answer honestly and briefly, then continue as Savant',
] as const

describe('system-prompt provider identity clause (FID-2026-0929-001)', () => {
  for (const mode of MODES) {
    test(`identity clause present in mode: ${mode}`, () => {
      const prompt = buildSystemPrompt(mode, {
        isFree: false,
        noGravityIndex: false,
        noAskUser: false,
        noFIDPerChange: false,
      })
      for (const fragment of IDENTITY_CLAUSE_FRAGMENTS) {
        expect(prompt).toContain(fragment)
      }
    })
  }

  test('free variant carries the same clause', () => {
    const prompt = buildSystemPrompt('free', {
      isFree: true,
      noGravityIndex: false,
      noAskUser: false,
      noFIDPerChange: false,
    })
    for (const fragment of IDENTITY_CLAUSE_FRAGMENTS) {
      expect(prompt).toContain(fragment)
    }
  })

  test('clause forbids volunteered provider branding in the default mode preamble path', () => {
    // The default mode output is the base prompt alone (no preamble) — the
    // clause lives in the base, so this pins its exact location.
    const prompt = buildSystemPrompt('default', {
      isFree: false,
      noGravityIndex: false,
      noAskUser: false,
      noFIDPerChange: false,
    })
    const clauseIndex = prompt.indexOf('Your name is Savant')
    const dateIndex = prompt.indexOf('Current date and time:')
    expect(clauseIndex).toBeGreaterThan(-1)
    expect(dateIndex).toBeGreaterThan(clauseIndex)
  })

  test('clause does not instruct the agent to deny its serving model when asked', () => {
    // Honest-by-construction guard: the clause must not ban naming the model
    // on direct questions — only persona adoption and volunteered branding.
    const prompt = buildSystemPrompt('default', {
      isFree: false,
      noGravityIndex: false,
      noAskUser: false,
      noFIDPerChange: false,
    })
    expect(prompt).toContain('answer honestly and briefly')
    expect(prompt).not.toContain('never reveal')
    expect(prompt).not.toContain('never mention')
  })
})
