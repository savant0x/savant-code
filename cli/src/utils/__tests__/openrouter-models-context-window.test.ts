// Openrouter-models test family — resolveContextWindowForModel. Sibling of
// the Loop-338 decomposition (shared lifecycle in
// ./openrouter-models-test-harness).

import { describe, expect, mock, test } from 'bun:test'

import {
  fetchGatewayModels,
  resolveContextWindowForModel,
} from '../openrouter-models'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('openrouter-models', () => {
  registerGatewayCatalogLifecycle()

  describe('resolveContextWindowForModel', () => {
    test('returns catalog contextLength when model is in gateway cache', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          makeJsonResponse({
            data: [
              { id: 'anthropic/claude-sonnet-4', context_length: 200000 },
              { id: 'google/gemini-2.5-pro', context_length: 1048576 },
            ],
          }),
        ),
      )
      await fetchGatewayModels(true)
      expect(resolveContextWindowForModel('anthropic/claude-sonnet-4')).toBe(
        200000,
      )
      expect(resolveContextWindowForModel('google/gemini-2.5-pro')).toBe(
        1048576,
      )
    })
    test('falls back to heuristic when model is not in catalog', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJsonResponse({ data: [] })),
      )
      await fetchGatewayModels(true)
      expect(resolveContextWindowForModel('google/gemini-flash')).toBe(1048576)
      expect(resolveContextWindowForModel('deepseek/deepseek-v3')).toBe(131072)
      expect(resolveContextWindowForModel('anthropic/claude-opus-4')).toBe(
        200000,
      )
    })
    test('returns default 200k for unknown models', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJsonResponse({ data: [] })),
      )
      await fetchGatewayModels(true)
      expect(resolveContextWindowForModel('unknown/provider-model')).toBe(
        200000,
      )
    })
    test('falls back to heuristic when catalog model has no contextLength', async () => {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(
          makeJsonResponse({
            data: [{ id: 'openai/custom-model', name: 'Custom Model' }],
          }),
        ),
      )
      await fetchGatewayModels(true)
      // Catalog hit but no contextLength, so falls through to heuristic
      expect(resolveContextWindowForModel('openai/custom-model')).toBe(200000)
    })
  })
})
