// OpenAI platform live catalog (FID-2026-1001-001) — fan-out pin, parser
// contract, and failure isolation, mirroring the KiosAPI cluster legs.

import { describe, expect, mock, test } from 'bun:test'

import {
  fetchGatewayModels,
  fetchOpenAiModels,
  hasOpenAiCatalog,
  parseOpenAiModelsForTest,
} from '../openrouter-models'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('openrouter-models OpenAI catalog (FID-2026-1001-001)', () => {
  registerGatewayCatalogLifecycle()

  test('parser prefixes bare platform ids exactly once', () => {
    const models = parseOpenAiModelsForTest({
      data: [{ id: 'gpt-5.3-codex' }, { id: 'openai/dup' }, {}],
    })
    expect(models.map((model) => model.id)).toEqual([
      'openai/dup',
      'openai/gpt-5.3-codex',
    ])
  })

  test('includes OpenAI models in the combined gateway catalog', async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'openai-catalog-test-key'
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(
        (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes('api.openai.com/v1/models')) {
            expect(new Headers(init?.headers).get('authorization')).toBe(
              'Bearer openai-catalog-test-key',
            )
            return Promise.resolve(
              makeJsonResponse({
                data: [{ id: 'gpt-5.3-codex' }, { id: 'gpt-5.4' }],
              }),
            )
          }
          return Promise.resolve(makeJsonResponse({ data: [] }))
        },
      )

      const models = await fetchGatewayModels(true)

      expect(hasOpenAiCatalog()).toBe(true)
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'openai/gpt-5.3-codex',
            provider: 'openai',
          }),
          expect.objectContaining({ id: 'openai/gpt-5.4', provider: 'openai' }),
        ]),
      )
    } finally {
      if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = originalOpenAiKey
    }
  })

  test('isolates OpenAI catalog failure while retaining other gateway models', async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'openai-catalog-test-key'
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('api.openai.com')) {
          return Promise.resolve(new Response('unauthorized', { status: 401 }))
        }
        if (url.includes('openrouter.ai')) {
          return Promise.resolve(
            makeJsonResponse({ data: [{ id: 'kept/model' }] }),
          )
        }
        return Promise.resolve(makeJsonResponse({ data: [] }))
      })

      const models = await fetchGatewayModels(true)

      expect(hasOpenAiCatalog()).toBe(false)
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'kept/model' }),
          expect.objectContaining({ id: 'tokenharbor/claude-haiku-5.5' }),
        ]),
      )
    } finally {
      if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = originalOpenAiKey
    }
  })

  test('fetchOpenAiModels degrades to an empty list without a key', async () => {
    delete process.env.OPENAI_API_KEY
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() => {
      throw new Error('network must not be touched without a key')
    })

    const models = await fetchOpenAiModels(true)
    expect(models).toEqual([])
    expect(hasOpenAiCatalog()).toBe(false)
  })
})
