/**
 * FID-2026-0916-002 — catalog window-truth pins.
 *
 * Covers the pre-program static providers (tokenrouter/tokenharbor/
 * opencode-go/commandcode): every curated id must carry a vendor-published
 * fallback-table window (closed-world invariant — this gap class cannot
 * reopen), spot windows from the 2026-09-16 keyed rosters, the dead-channel
 * removals (LIVE 503 evidence), and the tokenrouter protocol map (vendor
 * supported_endpoint_types, 2026-09-16).
 */

import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import {
  PROVIDER_PROTOCOL_MAPS,
  TOKENROUTER_PROTOCOLS,
  commandcodeModels,
  tokenharborModels,
  tokenrouterModels,
} from '@savant-code/common/constants/model-config'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import {
  fetchCommandCodeModels,
  getTokenHarborModels,
  fetchTokenRouterModels,
} from '../static-catalogs'

/** Every id of a catalog map must have a vendor fallback-table row. */
function expectFullTableCoverage(ids: readonly string[]): void {
  const missing = ids.filter((id) => !CONTEXT_WINDOW_FALLBACKS.has(id))
  expect(missing).toEqual([])
}

describe('FID-2026-0916-002: vendor fallback-table coverage', () => {
  test('every surviving tokenrouter id has a table row', () => {
    expectFullTableCoverage(Object.values(tokenrouterModels))
  })

  test('every tokenharbor id has a table row', () => {
    expectFullTableCoverage(Object.values(tokenharborModels))
  })

  test('every commandcode id has a table row', () => {
    expectFullTableCoverage(Object.values(commandcodeModels))
  })
})

describe('FID-2026-0916-002: spot windows (keyed rosters 2026-09-16)', () => {
  test('tokenharbor deepseek-v4-flash is 1,048,576 (was heuristic 131k)', () => {
    expect(getContextWindowFallback('tokenharbor/deepseek-v4-flash')).toEqual({
      contextWindow: 1_048_576,
      source: 'fallback-table',
    })
  })

  test('static fetcher carries the vendor window, not the family heuristic', () => {
    const harbor = getTokenHarborModels().find(
      (m) => m.id === 'tokenharbor/deepseek-v4-flash',
    )
    expect(harbor?.contextLength).toBe(1_048_576)

    const router = fetchTokenRouterModels().find(
      (m) => m.id === 'tokenrouter/deepseek/deepseek-v4-pro',
    )
    expect(router?.contextLength).toBe(1_048_576)

    const cc = fetchCommandCodeModels().find(
      (m) => m.id === 'commandcode/deepseek/deepseek-v4-flash',
    )
    expect(cc?.contextLength).toBe(1_048_576)
  })

  test('conflict-resolved windows match the 2-of-3 vendor vote', () => {
    // glm-5.2: bazaarlink 1,048,576 + OpenRouter 1,048,576 vs orcarouter 1,000,000
    expect(
      getContextWindowFallback('tokenrouter/z-ai/glm-5.2').contextWindow,
    ).toBe(1_048_576)
    // qwen3.6-plus: bazaarlink 1,000,000 + OpenRouter 1,000,000 vs orcarouter 1,048,576
    expect(
      getContextWindowFallback('tokenrouter/qwen/qwen3.6-plus').contextWindow,
    ).toBe(1_000_000)
    // glm-5.1: bazaarlink 204,800 + OpenRouter 204,800 vs orcarouter 200,000
    expect(
      getContextWindowFallback('tokenrouter/z-ai/glm-5.1').contextWindow,
    ).toBe(204_800)
  })

  test('orcarouter-free-class ids never enter these static catalogs', () => {
    // The orcarouter *-free cap lesson: free channels of OTHER gateways keep
    // their vendor-published windows (tokenharbor publishes them); nothing
    // here heuristic-fills an unknown window — coverage invariant above.
    expect(getContextWindowFallback('tokenharbor/th-orchestra')).toEqual({
      contextWindow: 200_000,
      source: 'fallback-table',
    })
  })
})

describe('FID-2026-0916-002: dead channels removed (LIVE 503, 2026-09-16)', () => {
  const ids = Object.values(tokenrouterModels)

  test('glm-5.2-free removed', () => {
    expect(ids).not.toContain('tokenrouter/z-ai/glm-5.2-free')
  })

  test('glm-5.3-free removed', () => {
    expect(ids).not.toContain('tokenrouter/z-ai/glm-5.3-free')
  })

  test('mirothinker-1-7-deepresearch removed', () => {
    expect(ids).not.toContain(
      'tokenrouter/miromind/mirothinker-1-7-deepresearch',
    )
  })

  test('MiniMax-M3 KEPT (alive despite roster absence — MQ3 rule)', () => {
    expect(ids).toContain('tokenrouter/MiniMax-M3')
  })

  test('image-only seedream removed from the coding catalog', () => {
    expect(ids).not.toContain('tokenrouter/bytedance-seed/seedream-5.0-pro')
  })
})

describe('FID-2026-0916-002: tokenrouter protocol map (vendor endpoint types)', () => {
  test('map registered in PROVIDER_PROTOCOL_MAPS', () => {
    expect(PROVIDER_PROTOCOL_MAPS.TOKENROUTER_PROTOCOLS).toBe(
      TOKENROUTER_PROTOCOLS,
    )
  })

  test('covers every surviving curated id (fail closed otherwise)', () => {
    const unmapped = Object.values(tokenrouterModels).filter(
      (id) => !(id in TOKENROUTER_PROTOCOLS),
    )
    expect(unmapped).toEqual([])
  })

  test('Responses-only family dispatches responses', () => {
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/openai/gpt-5.3-codex']).toBe(
      'responses',
    )
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/openai/gpt-5.4']).toBe(
      'responses',
    )
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/openai/gpt-5.5']).toBe(
      'responses',
    )
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/openai/gpt-5.5-pro']).toBe(
      'responses',
    )
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/openai/gpt-5.6-sol']).toBe(
      'responses',
    )
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/openai/gpt-5.6-terra']).toBe(
      'responses',
    )
  })

  test('Anthropic-only Claude family dispatches anthropic', () => {
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/anthropic/claude-fable-5']).toBe(
      'anthropic',
    )
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/anthropic/claude-opus-4.8']).toBe(
      'anthropic',
    )
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/anthropic/claude-sonnet-5']).toBe(
      'anthropic',
    )
  })

  test('Gemini-only id dispatches gemini; dual-eps glm-5.2 stays openai', () => {
    expect(
      TOKENROUTER_PROTOCOLS['tokenrouter/google/gemini-3.1-pro-preview'],
    ).toBe('gemini')
    expect(TOKENROUTER_PROTOCOLS['tokenrouter/z-ai/glm-5.2']).toBe('openai')
  })

  test('registry entry wires the map (multi + protocolMap)', () => {
    const entry = PROVIDER_REGISTRY.tokenrouter
    expect(entry.protocol).toBe('multi')
    expect(entry.protocolMap).toBe('TOKENROUTER_PROTOCOLS')
  })
})
