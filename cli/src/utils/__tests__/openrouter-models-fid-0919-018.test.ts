// FID-2026-0919-018 — mid-id-version gateway ids fall through the OpenRouter
// ladder to the 200k default.
//
// Live-proven defect (2026-09-19, dev/scratchpad/probe-glm-flash-window.ts):
// `kiosapi/glm-5.3-flash-free` → canonical `glm-5.3-flash` (version is
// MID-id, not terminal) → branch 3's terminal-version reduction can't fire,
// branch 3b's `familyName !== canonical` guard skips the exact case, and
// every tier below is structurally silent (kiosapi's OpenAI-compatible
// roster carries no context_length; fallback table has no kiosapi rows) →
// 200k `(default)` instead of z-ai/glm-5.3-flash's 1,310,720. The fixture
// mirrors the live catalog: the exact twin sits BETWEEN two near-collisions
// that strict terminal-segment equality must exclude.

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

describe('FID-2026-0919-018 — mid-id-version ladder fallthrough', () => {
  registerGatewayCatalogLifecycle()

  const GLM_FIXTURE = {
    data: [
      { id: 'z-ai/glm-5.3-flashx', context_length: 1_048_576 },
      { id: 'z-ai/glm-5.3-flash', context_length: 1_310_720 },
      { id: 'z-ai/glm-5.3-flash:batch', context_length: 1_048_576 },
      { id: 'z-ai/glm-5.2', context_length: 1_048_576 },
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

  test('kiosapi/glm-5.3-flash-free resolves to the exact twin (1,310,720), not the default', async () => {
    await seedOpenRouter(GLM_FIXTURE)
    expect(resolveContextWindowForModel('kiosapi/glm-5.3-flash-free')).toBe(
      1_310_720,
    )
    expect(
      resolveContextWindowSourceForModel('kiosapi/glm-5.3-flash-free'),
    ).toBe('catalog')
  })

  test('no bleed into near-collisions: flashx and :batch keep their own windows', async () => {
    await seedOpenRouter(GLM_FIXTURE)
    // Strip the twin away: only the collisions remain. The terminal-segment
    // equality must NOT match "glm-5.3-flashx" or "glm-5.3-flash:batch".
    await seedOpenRouter({
      data: [
        { id: 'z-ai/glm-5.3-flashx', context_length: 1_048_576 },
        { id: 'z-ai/glm-5.3-flash:batch', context_length: 1_048_576 },
      ],
    })
    expect(resolveContextWindowForModel('kiosapi/glm-5.3-flash-free')).toBe(
      200_000,
    )
    expect(
      resolveContextWindowSourceForModel('kiosapi/glm-5.3-flash-free'),
    ).toBe('default')
  })

  test('terminal-version ids keep their FID-016 behavior (no regression)', async () => {
    await seedOpenRouter({
      data: [
        { id: 'x-ai/grok-4.20', context_length: 2_000_000 },
        { id: 'x-ai/grok-4.6', context_length: 500_000 },
      ],
    })
    // Branch 2b must not shadow the terminal-version path: the exact twin
    // for grok-4.6 is still found (here via 2b, identical answer).
    expect(resolveContextWindowForModel('kiosapi/grok-4.6-free')).toBe(500_000)
    expect(resolveContextWindowSourceForModel('kiosapi/grok-4.6-free')).toBe(
      'catalog',
    )
  })

  test('max-output resolution benefits from the same terminal-segment match (shared ladder)', async () => {
    await seedOpenRouter({
      data: [
        {
          id: 'z-ai/glm-5.3-flash',
          context_length: 1_310_720,
          max_completion_tokens: 131_072,
        },
      ],
    })
    expect(resolveMaxOutputTokensForModel('kiosapi/glm-5.3-flash-free')).toBe(
      131_072,
    )
  })

  test('FID-2026-0919-019: terminal-segment match is case-insensitive (Qwen3-8B shape)', async () => {
    await seedOpenRouter({
      data: [{ id: 'qwen/qwen3-8b', context_length: 131_072 }],
    })
    // The gateway preserves HuggingFace casing; the catalog lowercases.
    expect(resolveContextWindowForModel('kiosapi/Qwen/Qwen3-8B')).toBe(131_072)
    expect(resolveContextWindowSourceForModel('kiosapi/Qwen/Qwen3-8B')).toBe(
      'catalog',
    )
    // Case-insensitivity must not loosen segment identity: a different
    // segment that merely matches case-folded is still NOT a twin.
    await seedOpenRouter({
      data: [{ id: 'qwen/qwen3-8b-instruct', context_length: 65_536 }],
    })
    expect(resolveContextWindowForModel('kiosapi/Qwen/Qwen3-8B')).toBe(200_000)
  })

  test('unknown models still land on the conservative default, never a guess', async () => {
    await seedOpenRouter({ data: [] })
    expect(resolveContextWindowForModel('kiosapi/totally-unknown-free')).toBe(
      200_000,
    )
  })
})
