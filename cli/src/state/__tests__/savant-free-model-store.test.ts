/**
 * FID-2026-0814-004 H-08..H-12 regression gate — one model project-wide.
 *
 * The UI model store (`getSelectedSavantFreeModel()`) is the SINGLE source of
 * truth for the effective model: main agent, teacher-forge, sub-agent spawn,
 * and headless runs must all resolve from it. A store selection can never be
 * silently upgraded to a bundled paid default.
 */
import { describe, expect, test } from 'bun:test'

import { resolveInitialSelectedModel } from '../savant-free-model-store'

describe('resolveInitialSelectedModel — paid build (the CLI that ships here)', () => {
  test('a stale savant-free preference is IGNORED (FID-2026-0814-010)', () => {
    // A leftover free-build preference (minimax-m3, paid on OpenRouter) must
    // never override the operator's paid selection or the openrouter/free
    // fallback. The first argument is the savant-free preference and is only
    // consulted in the SavantFree build.
    expect(
      resolveInitialSelectedModel(
        'minimax/minimax-m3',
        'nous/tencent/hy3:free',
      ),
    ).toBe('nous/tencent/hy3:free')
    expect(resolveInitialSelectedModel('minimax/minimax-m3', undefined)).toBe(
      'openrouter/free',
    )
  })

  test('only the savant-code preference is trusted', () => {
    expect(
      resolveInitialSelectedModel(undefined, 'nous/tencent/hy3:free'),
    ).toBe('nous/tencent/hy3:free')
  })

  test('an empty store falls back to openrouter/free — never a paid model', () => {
    // IS_SAVANT_FREE is false in this build, and with no saved preference the
    // default is openrouter/free (DEFAULT_SAVANT_CODE_MODEL_ID). The free
    // catalog default (minimax-m3, paid on OpenRouter) must NEVER apply here.
    const resolved = resolveInitialSelectedModel(undefined, undefined)
    expect(resolved).toBe('openrouter/free')
  })

  test('a saved preference beats the fallback', () => {
    expect(resolveInitialSelectedModel(undefined, 'openrouter/free')).toBe(
      'openrouter/free',
    )
  })
})

describe('FID-2026-0814-004 model-unification regression gate', () => {
  test('bundled roster carries no inheritParentModel:false escape', async () => {
    const { bundledAgents } =
      await import('../../agents/bundled-agents.generated')
    const escapes = Object.values(bundledAgents).filter(
      (agent) => agent.inheritParentModel === false,
    )
    expect(escapes).toEqual([])
  })

  test('bundled roster has no Gemini thinker hardcodes', async () => {
    const { bundledAgents } =
      await import('../../agents/bundled-agents.generated')
    const thinkers = ['thinker-gemini', 'thinker-with-files-gemini']
    for (const id of thinkers) {
      const agent = bundledAgents[id]
      expect(agent).toBeDefined()
      // The model is display metadata; it must not be a paid Gemini hardcode
      // that could become the effective model of a live run.
      expect(agent.model).not.toMatch(/^google\/gemini-/)
    }
  })

  test('teacher-forge default is free-safe, never a paid hardcode', async () => {
    const { TEACHER_FORGE_AGENT, resolveTeacherForgeAgent } =
      await import('../../teacher/forge')
    // The bundled default is display metadata only and free-safe.
    expect(TEACHER_FORGE_AGENT.model).toBe('openrouter/free')
    // Every resolution carries the caller's model verbatim — a free selection
    // can never be upgraded to a paid model by this seam.
    expect(resolveTeacherForgeAgent('nous/tencent/hy3:free').model).toBe(
      'nous/tencent/hy3:free',
    )
    expect(resolveTeacherForgeAgent('openrouter/free').model).toBe(
      'openrouter/free',
    )
  })

  test('applySavantCodeModelOverride resolves from the store, not the code preference', async () => {
    const store = await import('../savant-free-model-store')
    const { applySavantCodeModelOverride } =
      await import('../../hooks/helpers/send-message-agent')
    // Set the store to a free model and verify the override picks it up —
    // even when the code preference is empty (the GUI-picked case that used
    // to fall through to a bundled paid default).
    store.useSavantFreeModelStore
      .getState()
      .setSelectedModel('nous/tencent/hy3:free')
    const { bundledAgents } =
      await import('../../agents/bundled-agents.generated')
    // Use the real bundled savant definition (a paid default on OpenRouter)
    // — the store override must win over it.
    const overridden = applySavantCodeModelOverride(bundledAgents['savant'], [])
    expect(overridden).not.toBe(bundledAgents['savant'])
    expect(typeof overridden !== 'string' && overridden.model).toBe(
      'nous/tencent/hy3:free',
    )
  })
})
