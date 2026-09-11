// Openrouter-models test family — resolveMaxOutputTokensForModel
// (FID-2026-0909-008 Step 4). Sibling of the context-window suite; shares the
// family lifecycle in ./openrouter-models-test-harness.

import { describe, expect, mock, test } from 'bun:test'

import {
  fetchGatewayModels,
  resolveMaxOutputTokensForModel,
} from '../openrouter-models'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('openrouter-models', () => {
  registerGatewayCatalogLifecycle()

  describe('resolveMaxOutputTokensForModel', () => {
    test('returns the catalog max_completion_tokens on a direct hit', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          makeJsonResponse({
            data: [
              {
                id: 'z-ai/glm-5.2',
                max_completion_tokens: 65536,
              },
            ],
          }),
        ),
      )
      await fetchGatewayModels(true)
      expect(resolveMaxOutputTokensForModel('z-ai/glm-5.2')).toBe(65536)
    })

    test('canonicalizes gateway-prefixed ids before the catalog lookup', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          makeJsonResponse({
            data: [
              {
                id: 'z-ai/glm-5.2',
                max_completion_tokens: 32768,
              },
            ],
          }),
        ),
      )
      await fetchGatewayModels(true)
      expect(
        resolveMaxOutputTokensForModel('tokenrouter/z-ai/glm-5.2-free'),
      ).toBe(32768)
    })

    test('prefers top_provider.max_completion_tokens over the top-level field', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          makeJsonResponse({
            data: [
              {
                id: 'openai/gpt-5',
                max_completion_tokens: 8192,
                top_provider: { max_completion_tokens: 128000 },
              },
            ],
          }),
        ),
      )
      await fetchGatewayModels(true)
      expect(resolveMaxOutputTokensForModel('openai/gpt-5')).toBe(128000)
    })

    test('resolves the output cap from the top_provider alone when the top-level field is absent', async () => {
      // The OpenRouter API often omits the top-level field for resold models
      // (the same shape the contextLength picker handles).
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          makeJsonResponse({
            data: [
              {
                id: 'xiaomi/mimo-v2.5',
                top_provider: { max_completion_tokens: 40960 },
              },
            ],
          }),
        ),
      )
      await fetchGatewayModels(true)
      expect(resolveMaxOutputTokensForModel('xiaomi/mimo-v2.5')).toBe(40960)
    })

    test('is undefined for unknown models — never an invented value', async () => {
      // THE core pin (FID-2026-0909-008 Step 4): when no catalog reports a
      // cap, the resolver yields undefined so max_tokens is omitted from the
      // request — an invented number (window fraction, fixed constant) can
      // exceed a provider's true cap and turn recoverable truncation into
      // hard request rejection.
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJsonResponse({ data: [] })),
      )
      await fetchGatewayModels(true)
      expect(
        resolveMaxOutputTokensForModel('unknown/provider-model'),
      ).toBeUndefined()
    })

    test('leaves models that report no cap undefined even when listed', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          makeJsonResponse({
            data: [{ id: 'openai/custom-model', name: 'Custom Model' }],
          }),
        ),
      )
      await fetchGatewayModels(true)
      expect(
        resolveMaxOutputTokensForModel('openai/custom-model'),
      ).toBeUndefined()
    })
  })
})
