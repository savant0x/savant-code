// Openrouter-models test family — catalog parsing, cache, and formatting.
// Sibling of the Loop-338 decomposition (shared lifecycle in
// ./openrouter-models-test-harness).

import { describe, expect, mock, test } from 'bun:test'

import {
  fetchOpenRouterModels,
  formatModelInfo,
  getCachedOpenRouterModels,
  hasOpenRouterCatalog,
} from '../openrouter-models'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('openrouter-models', () => {
  registerGatewayCatalogLifecycle()

  test('parses the live catalog shape (id, name, context, pricing)', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [
            {
              id: 'anthropic/claude-sonnet-4',
              name: 'Anthropic: Claude Sonnet 4',
              description: 'Fast, capable reasoning model.',
              context_length: 200000,
              max_completion_tokens: 8192,
              pricing: { prompt: '0.000003', completion: '0.000015' },
              provider: 'Anthropic',
              modality: 'text+image',
              tokenizer: 'claude',
              instruct_type: 'chat',
              knowledge_cutoff: '2025-10',
              created: '2026-07-15',
            },
            { id: 'openai/gpt-4o', name: 'OpenAI: GPT-4o' },
          ],
        }),
      ),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models).toHaveLength(2)
    expect(models[0].id).toBe('anthropic/claude-sonnet-4')
    expect(models[0].name).toBe('Anthropic: Claude Sonnet 4')
    expect(models[0].description).toBe('Fast, capable reasoning model.')
    expect(models[0].contextLength).toBe(200000)
    expect(models[0].maxCompletionTokens).toBe(8192)
    expect(models[0].promptPricePerToken).toBe(0.000003)
    expect(models[0].completionPricePerToken).toBe(0.000015)
    expect(models[0].provider).toBeUndefined()
    expect(models[0].modality).toBe('text+image')
    expect(models[0].tokenizer).toBe('claude')
    expect(models[0].instructType).toBe('chat')
    expect(models[0].knowledgeCutoff).toBe('2025-10')
    expect(models[0].created).toBe('2026-07-15')
    // Sorted by id
    expect(models[1].id).toBe('openai/gpt-4o')
    expect(hasOpenRouterCatalog()).toBe(true)
    expect(getCachedOpenRouterModels()).toHaveLength(2)
  })
  test('skips entries without an id', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({ data: [{ name: 'no id' }, { id: 'x/y' }] }),
      ),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models).toHaveLength(1)
    expect(models[0].id).toBe('x/y')
  })

  // ---- REAL-PAYLOAD legs (measured 2026-09-27, HTTP 200, 458 models) ----
  //
  // The synthetic fixture above uses FLAT modality/tokenizer/instruct_type,
  // which OpenRouter does NOT serve: measured across all 458 live models the
  // flat keys are populated on 0/458 while `architecture.*` is present on
  // 458/458. So the parser's only read — the flat one — yielded `undefined`
  // for every real model, and `formatModelInfo` rendered no modalities line.
  // These legs pin the shape the vendor actually serves.

  test('maps the real nested architecture.* fields', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [
            {
              id: 'typesafe/jev-router',
              name: 'Jev Router',
              created: 1780000000,
              context_length: 1000000,
              architecture: {
                modality: 'text+image+file+audio+video->text',
                input_modalities: ['audio', 'file', 'image', 'text', 'video'],
                output_modalities: ['text'],
                tokenizer: 'Router',
                instruct_type: null,
              },
              pricing: { prompt: '-1', completion: '-1' },
              top_provider: {
                context_length: null,
                max_completion_tokens: null,
                is_moderated: false,
              },
            },
          ],
        }),
      ),
    )
    const models = await fetchOpenRouterModels(true)
    const m = models[0]
    expect(m?.modality).toBe('text+image+file+audio+video->text')
    expect(m?.tokenizer).toBe('Router')
    // `instruct_type` is null in the real payload — absent, not empty-string.
    expect(m?.instructType).toBeUndefined()
    expect(m?.topProvider).toEqual({
      contextLength: undefined,
      maxCompletionTokens: undefined,
      isModerated: false,
    })
  })

  test('nested architecture.* wins when flat keys are also present', async () => {
    // Guards the `??` order: the nested value is the one the vendor serves, so
    // a stale flat copy must not win. (An accidental swap would pass the
    // synthetic leg above while breaking every real model.)
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [
            {
              id: 'a/b',
              modality: 'FLAT-SHOULD-LOSE',
              tokenizer: 'FLAT-SHOULD-LOSE',
              instruct_type: 'FLAT-SHOULD-LOSE',
              architecture: {
                modality: 'NESTED-WINS',
                tokenizer: 'NESTED-WINS',
                instruct_type: 'NESTED-WINS',
              },
            },
          ],
        }),
      ),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models[0]?.modality).toBe('NESTED-WINS')
    expect(models[0]?.tokenizer).toBe('NESTED-WINS')
    expect(models[0]?.instructType).toBe('NESTED-WINS')
  })

  test('a null nested instruct_type falls back to flat, not "null"', async () => {
    // Negative leg for the `??` chain: a null nested value must not be
    // stringified, and must not mask a genuine flat value.
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [
            {
              id: 'a/b',
              instruct_type: 'flat-chat',
              architecture: { modality: 'text->text', instruct_type: null },
            },
          ],
        }),
      ),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models[0]?.instructType).toBe('flat-chat')
    expect(models[0]?.modality).toBe('text->text')
  })
  test('degrades to empty list on fetch failure (never throws)', async () => {
    // @ts-expect-error - mock fetch to reject
    globalThis.fetch = mock(() => Promise.reject(new Error('network down')))
    const models = await fetchOpenRouterModels(true)
    expect(models).toEqual([])
  })
  test('degrades to empty list on non-200 response', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('err', { status: 500 })),
    )
    const models = await fetchOpenRouterModels(true)
    expect(models).toEqual([])
  })
  test('returns cached catalog without refetching when fresh', async () => {
    let calls = 0
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() => {
      calls++
      return Promise.resolve(
        makeJsonResponse({ data: [{ id: 'a/b' }, { id: 'c/d' }] }),
      )
    })
    await fetchOpenRouterModels(true)
    const firstCalls = calls
    // Within TTL: should not call fetch again.
    const cached = await fetchOpenRouterModels()
    expect(cached.length).toBe(2)
    expect(calls).toBe(firstCalls)
  })
  test('formatModelInfo renders full metadata block', () => {
    const info = formatModelInfo('anthropic/claude-sonnet-4', {
      id: 'anthropic/claude-sonnet-4',
      name: 'Claude Sonnet 4',
      description: 'Fast reasoning model.',
      contextLength: 200000,
      maxCompletionTokens: 8192,
      promptPricePerToken: 0.000003,
      completionPricePerToken: 0.000015,
      provider: 'openrouter',
      modality: 'text+image',
      tokenizer: 'claude',
      instructType: 'chat',
      knowledgeCutoff: '2025-10',
      created: '2026-07-15',
    })
    expect(info).toContain('# Model Information')
    expect(info).toContain('Claude Sonnet 4')
    expect(info).toContain('anthropic/claude-sonnet-4')
    expect(info).toContain('200,000 tokens')
    expect(info).toContain('8,192')
    expect(info).toContain('$3.00 per 1M tokens')
    expect(info).toContain('$15.00 per 1M tokens')
    expect(info).toContain('text+image')
    expect(info).toContain('2025-10')
  })
  test('formatModelInfo falls back gracefully for unknown model', () => {
    const info = formatModelInfo('unknown/model')
    expect(info).toContain('# Model Information')
    expect(info).toContain('unknown/model')
    expect(info).toContain('not found')
  })
})
