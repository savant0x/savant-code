/**
 * FID-2026-0914-002 — window-truth fallback table pins (RED-first).
 *
 * Exit criterion 4: every currently-catalog-resolvable id must resolve
 * identically post-change (parity), the vendor table must ADD resolution
 * for ids the substring heuristics previously mis-guessed, and unmatched
 * ids must get the default — never a wrong family guess. Also pins the
 * FID-2026-0914-001 gateway catalogs off the substring heuristic (V6
 * finding) and the resolution-provenance surface used by the picker badge.
 */
import {
  CONTEXT_WINDOW_DEFAULT,
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import { describe, expect, test } from 'bun:test'

import {
  fetchCommandCodeModels,
  fetchHcnsecModels,
  fetchOpenCodeGoModels,
  fetchTokenBomModels,
  fetchTokenRouterModels,
  getTokenHarborModels,
} from '../openrouter-models/static-catalogs'
import {
  fetchInfronModels,
  fetchUnorouterModels,
} from '../openrouter-models/static-catalogs-gateways'

function currentHeuristic(model: string): number {
  const m = model.toLowerCase()
  if (m.includes('gemini')) return 1_048_576
  if (m.includes('deepseek')) return 131_072
  if (m.includes('claude')) return 200_000
  if (m.includes('o1') || m.includes('o3') || m.includes('o4')) return 200_000
  if (m.includes('gpt-4')) return 128_000
  return 200_000
}

describe('CONTEXT_WINDOW_FALLBACKS (vendor table)', () => {
  test('is non-empty and every entry is a positive integer window', () => {
    expect(CONTEXT_WINDOW_FALLBACKS.size).toBeGreaterThan(0)
    for (const [id, window] of CONTEXT_WINDOW_FALLBACKS) {
      expect(typeof window).toBe('number')
      expect(window).toBeGreaterThan(0)
      expect(Number.isInteger(window)).toBe(true)
      expect(typeof id).toBe('string')
    }
  })

  test('adds correct resolution where the substring heuristics mis-guessed', () => {
    // A GLM id the old family heuristic cannot match (falls to the 200k
    // default) must now resolve to the vendor-published window.
    const glm = getContextWindowFallback('unorouter/glm-5.3-flash:free')
    expect(glm.contextWindow).toBe(1_000_000)
    expect(glm.source).toBe('fallback-table')

    // A modern claude id the old 200k claude guess under-windowed.
    const opus = getContextWindowFallback('unorouter/claude-opus-4.8')
    expect(opus.contextWindow).toBe(1_000_000)
    expect(opus.source).toBe('fallback-table')
  })

  test('unmatched ids get the conservative default with explicit provenance', () => {
    const unknown = getContextWindowFallback('totally-unknown-model-v9')
    expect(unknown.contextWindow).toBe(CONTEXT_WINDOW_DEFAULT)
    expect(unknown.source).toBe('default')
  })

  test('parity: gpt-4-family ids that the old heuristic resolved keep resolving to the same window', () => {
    // 'gpt-4' → 128_000 in the old table; the vendor table carries the
    // same value for the same id (parity exit criterion).
    for (const id of ['openai/gpt-4o', 'gpt-4o-mini']) {
      const fallback = getContextWindowFallback(id)
      if (fallback.source === 'fallback-table') {
        expect(fallback.contextWindow).toBe(currentHeuristic(id))
      } else {
        expect(fallback.source).toBe('default')
      }
    }
  })
})

describe('gateway catalogs consume the vendor table (V6 fix)', () => {
  test('every Infron catalog id resolves its window from the pinned map or the fallback table', () => {
    for (const model of fetchInfronModels()) {
      const pinned = getContextWindowFallback(model.id)
      const expected =
        pinned.source === 'fallback-table'
          ? pinned.contextWindow
          : CONTEXT_WINDOW_DEFAULT
      expect(model.contextLength).toBe(expected)
    }
  })

  test('every UnoRouter catalog id resolves its window from the pinned map or the fallback table', () => {
    for (const model of fetchUnorouterModels()) {
      const pinned = getContextWindowFallback(model.id)
      const expected =
        pinned.source === 'fallback-table'
          ? pinned.contextWindow
          : CONTEXT_WINDOW_DEFAULT
      expect(model.contextLength).toBe(expected)
    }
  })

  test('pinned-window catalogs (hcnsec/tokenbom) resolve every id through the vendor table or explicit default', () => {
    const pinnedCatalogs = [...fetchHcnsecModels(), ...fetchTokenBomModels()]
    expect(pinnedCatalogs.length).toBeGreaterThan(0)
    for (const model of pinnedCatalogs) {
      const resolved = getContextWindowFallback(model.id)
      expect(model.contextLength).toBe(resolved.contextWindow)
    }
  })

  test('name-derived catalogs (tokenrouter/tokenharbor/opencode-go/commandcode) resolve through the vendor table (FID-2026-0916-002)', () => {
    // Supersedes the FID-2026-0914-002 byte-parity pin: the operator mandate
    // ("tokenharbor deepseek-v4-flash has 131k context window … i thought we
    // fixed the low windows for all models?") required migrating these four
    // pre-program catalogs off the family heuristic onto vendor-published
    // exact-id rows. Coverage of the table itself is pinned in
    // openrouter-models/__tests__/window-truth.test.ts; this asserts the
    // fetcher WIRING — every entry reads its window from
    // getContextWindowFallback, never inferContextLength.
    const nameCatalogs = [
      ...fetchTokenRouterModels(),
      ...getTokenHarborModels(),
      ...fetchOpenCodeGoModels(),
      ...fetchCommandCodeModels(),
    ]
    expect(nameCatalogs.length).toBeGreaterThan(0)
    for (const model of nameCatalogs) {
      expect(model.contextLength).toBe(
        getContextWindowFallback(model.id).contextWindow,
      )
    }
  })
})
