import { describe, expect, test } from 'bun:test'

import { parseVercelModelsForTest } from '../openrouter-models/vercel'

/**
 * Catalog contract pins for the Vercel AI Gateway live catalog
 * (FID-2026-0927-001). No network access — the parser seam is exercised
 * directly with shapes probed from the live endpoint 2026-09-27 (391 models,
 * keyless HTTP 200, OpenAI list shape with gateway-specific fields).
 */
describe('vercel live catalog parser (FID-2026-0927-001)', () => {
  test('prefixes vendor-namespaced ids uniformly', () => {
    const models = parseVercelModelsForTest({
      data: [
        { id: 'alibaba/qwen-3-14b' },
        { id: 'anthropic/claude-opus-5' },
        { id: 'openai/gpt-6-astra' },
      ],
    })
    expect(models.map((m) => m.id)).toEqual([
      'vercel/alibaba/qwen-3-14b',
      'vercel/anthropic/claude-opus-5',
      'vercel/openai/gpt-6-astra',
    ])
    expect(models.every((m) => m.provider === 'vercel')).toBe(true)
  })

  test('already-prefixed ids stay single-prefixed (no double prefix)', () => {
    // Uniform prefixing is load-bearing: `strip` removes exactly one segment,
    // so the wire id must equal the upstream catalog id after one strip even
    // for an upstream id that already starts with `vercel/` (the orcarouter
    // precedent — a passthrough branch would send an un-routable remainder).
    const models = parseVercelModelsForTest({
      data: [{ id: 'vercel/router', context_window: 200000 }],
    })
    expect(models.map((m) => m.id)).toEqual(['vercel/vercel/router'])
    expect('vercel/vercel/router'.slice('vercel/'.length)).toBe('vercel/router')
    expect(models[0]?.contextLength).toBe(200000)
  })

  test('maps gateway window fields and stringifies created', () => {
    // Measured wire shape (2026-09-27): the gateway publishes
    // `context_window`/`max_tokens`, NOT openrouter's
    // `context_length`/`max_completion_tokens`, and `created` is numeric.
    const models = parseVercelModelsForTest({
      data: [
        {
          id: 'alibaba/qwen-3-14b',
          name: 'Qwen3-14B',
          description: 'Qwen3 dense and MoE models.',
          context_window: 40960,
          max_tokens: 16384,
          created: 1755815280,
        },
      ],
    })
    const model = models[0]
    expect(model?.name).toBe('Qwen3-14B')
    expect(model?.description).toBe('Qwen3 dense and MoE models.')
    expect(model?.contextLength).toBe(40960)
    expect(model?.maxCompletionTokens).toBe(16384)
    // OpenRouterModel.created is a string (types.ts) — numeric wire value
    // stringified, never dropped.
    expect(model?.created).toBe('1755815280')
  })

  test('drops id-less rows and tolerates missing optional fields', () => {
    const models = parseVercelModelsForTest({
      data: [{ id: '' }, { id: 42 }, {}, { id: 'openai/gpt-5.5' }],
    })
    expect(models.map((m) => m.id)).toEqual(['vercel/openai/gpt-5.5'])
    const gpt = models[0]
    expect(gpt?.name).toBe('openai/gpt-5.5')
    expect(gpt?.description).toBeUndefined()
    expect(gpt?.contextLength).toBeUndefined()
    expect(gpt?.maxCompletionTokens).toBeUndefined()
    expect(gpt?.created).toBeUndefined()
  })

  test('nested architecture fields stay unmapped (T96-followup probe 2026-09-28)', () => {
    // Measured live 2026-09-28 (HTTP 200, 389 models): no `architecture.*`
    // object and no flat modality/tokenizer/instruct_type — 0/389 in both
    // positions (T96-followup / FID-2026-0927-006). The gateway serves only
    // OpenAI-list fields; a nested read would populate nothing.
    const models = parseVercelModelsForTest({
      data: [
        {
          id: 'alibaba/qwen-3-14b',
          architecture: { modality: 'text->text', tokenizer: 'Other' },
          modality: 'text->text',
        } as Record<string, unknown>,
      ],
    })
    expect(models[0]?.modality).toBeUndefined()
    expect(models[0]?.tokenizer).toBeUndefined()
    expect(models[0]?.instructType).toBeUndefined()
  })

  test('empty/missing data yields an empty catalog (degrade, not throw)', () => {
    expect(parseVercelModelsForTest({})).toEqual([])
    expect(parseVercelModelsForTest({ data: [] })).toEqual([])
  })
})
