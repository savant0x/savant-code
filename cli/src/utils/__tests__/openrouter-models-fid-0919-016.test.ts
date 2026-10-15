// FID-2026-0919-016 — registry-driven prefix stripping + version-preference
// family matching in the context-window / max-output resolvers.
//
// Live-proven defect (2026-09-19, dev/scratchpad/probe-grok-window.ts):
// `kiosapi/grok-4.6-free` kept its unstripped prefix, missed every exact
// branch, and the version-blind family fallback (first hit in id-sorted
// order) handed it x-ai/grok-4.20's 2,000,000 window instead of
// x-ai/grok-4.6's 500,000. The fixture below mirrors that sorted-catalog
// shape exactly.

import { describe, expect, mock, test } from 'bun:test'

import {
  fetchGatewayModels,
  fetchOpenRouterModels,
  resolveContextWindowForModel,
  resolveContextWindowSourceForModel,
  resolveMaxOutputTokensForModel,
} from '../openrouter-models'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('FID-2026-0919-016 — gateway window resolution', () => {
  registerGatewayCatalogLifecycle()

  const GROK_FIXTURE = {
    data: [
      { id: 'x-ai/grok-4.20', context_length: 2_000_000 },
      { id: 'x-ai/grok-4.20-multi-agent', context_length: 2_000_000 },
      { id: 'x-ai/grok-4.3', context_length: 1_000_000 },
      { id: 'x-ai/grok-4.5', context_length: 500_000 },
      { id: 'x-ai/grok-4.6', context_length: 500_000 },
      { id: 'x-ai/grok-build-0.1', context_length: 256_000 },
    ],
  }

  async function seedOpenRouter(body: unknown): Promise<void> {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('openrouter.ai/api/v1/models')) {
        return Promise.resolve(makeJsonResponse(body))
      }
      return Promise.resolve(makeJsonResponse({ data: [] }))
    })
    await fetchOpenRouterModels(true)
    await fetchGatewayModels(true)
  }

  test('kiosapi/grok-4.6-free resolves to the 4.6 window (500k), not the 4.20 sibling (2M)', async () => {
    await seedOpenRouter(GROK_FIXTURE)
    expect(resolveContextWindowForModel('kiosapi/grok-4.6-free')).toBe(500_000)
    expect(resolveContextWindowSourceForModel('kiosapi/grok-4.6-free')).toBe(
      'catalog',
    )
  })

  test('each versioned sibling keeps its own window (no cross-version bleed)', async () => {
    await seedOpenRouter(GROK_FIXTURE)
    expect(resolveContextWindowForModel('kiosapi/grok-4.3-free')).toBe(
      1_000_000,
    )
    expect(resolveContextWindowForModel('kiosapi/grok-4.5-free')).toBe(500_000)
  })

  test('registry-driven stripping covers new gateways, not just the legacy trio', async () => {
    await seedOpenRouter(GROK_FIXTURE)
    expect(resolveContextWindowForModel('tokenbom/grok-4.6')).toBe(500_000)
    expect(resolveContextWindowForModel('infron/grok-4.6:free')).toBe(500_000)
  })

  test('legacy trio stripping is preserved (regression guard)', async () => {
    await seedOpenRouter({
      data: [
        {
          id: 'z-ai/glm-5.2',
          context_length: 1_000_000,
          top_provider: { max_completion_tokens: 131_072 },
        },
      ],
    })
    expect(resolveContextWindowForModel('tokenrouter/z-ai/glm-5.2-free')).toBe(
      1_000_000,
    )
    expect(
      resolveMaxOutputTokensForModel('tokenrouter/z-ai/glm-5.2-free'),
    ).toBe(131_072)
  })

  test('max-output resolution benefits from the same exact-version match', async () => {
    await seedOpenRouter({
      data: [
        {
          id: 'x-ai/grok-4.20',
          context_length: 2_000_000,
          max_completion_tokens: 300_000,
        },
        {
          id: 'x-ai/grok-4.6',
          context_length: 500_000,
          max_completion_tokens: 120_000,
        },
      ],
    })
    expect(resolveMaxOutputTokensForModel('kiosapi/grok-4.6-free')).toBe(
      120_000,
    )
  })

  test('family fallback still answers when the exact version has no upstream twin', async () => {
    await seedOpenRouter(GROK_FIXTURE)
    // A version with no exact terminal-segment twin falls back to the
    // sorted-first family hit (unchanged legacy behavior for new versions).
    expect(resolveContextWindowForModel('kiosapi/grok-9.9-free')).toBe(
      2_000_000,
    )
  })

  test('unmatched models still land on the conservative default, never a guess', async () => {
    await seedOpenRouter({ data: [] })
    expect(resolveContextWindowForModel('kiosapi/unknown-model-free')).toBe(
      200_000,
    )
  })
})
