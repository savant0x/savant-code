import { describe, expect, test } from 'bun:test'

import { parseNousModelsForTest } from '../openrouter-models/nous'

/**
 * Catalog contract pins for the Nous Research live catalog.
 *
 * No network access — the parser seam is exercised directly.
 *
 * **Shape provenance: MEASURED 2026-09-27** against the live endpoint
 * (keyless, HTTP 200, **417 models**). Nous is an OpenRouter-shaped dialect:
 *
 * - `architecture.*` present on **417/417**; flat `modality` / `tokenizer` /
 *   `instruct_type` populated on **0/417**;
 * - `top_provider` present on **417/417** and carrying REAL numbers
 *   (`context_length: 36864`, `max_completion_tokens: 8192`) — unlike
 *   OpenRouter, where those are `null` for routed models;
 * - `pricing.prompt` / `.completion` are decimal **strings**.
 *
 * Before this mapping the parser read six fields and ignored all three of
 * those, so every Nous model rendered with no modalities line and no prices.
 * Population after the fix: `topProvider` 417/417, `promptPricePerToken`
 * 417/417, `modality` **408/417** — 9 models carry an `architecture` object
 * with no modality value, and the parser omits rather than fabricates.
 */
describe('nous live catalog parser', () => {
  const REAL_PERCEPTRON = {
    id: 'perceptron/perceptron-mk1.5',
    name: 'Perceptron MK1.5',
    description: 'Perceptron reasoning model.',
    context_length: 36864,
    architecture: {
      modality: 'text+image+audio+video->text',
      input_modalities: ['text', 'image', 'video', 'audio'],
      output_modalities: ['text'],
      tokenizer: 'Other',
      instruct_type: null,
    },
    pricing: { prompt: '0.0000001500', completion: '0.0000015000' },
    top_provider: {
      context_length: 36864,
      max_completion_tokens: 8192,
      is_moderated: false,
    },
  } as const

  test('prefixes bare upstream ids for picker routing', () => {
    const models = parseNousModelsForTest({
      data: [{ id: 'hermes-4-405b' }, { id: 'perceptron/perceptron-mk1.5' }],
    })
    expect(models.map((m) => m.id)).toEqual([
      'nous/hermes-4-405b',
      'nous/perceptron/perceptron-mk1.5',
    ])
    expect(models.every((m) => m.provider === 'nous')).toBe(true)
  })

  test('maps the real nested architecture.* fields', () => {
    // The measured drift: `architecture.*` on 417/417, flat keys on 0/417.
    const model = parseNousModelsForTest({ data: [REAL_PERCEPTRON] })[0]
    expect(model?.modality).toBe('text+image+audio+video->text')
    expect(model?.tokenizer).toBe('Other')
    // `instruct_type` is null in the real payload — absent, not empty-string.
    expect(model?.instructType).toBeUndefined()
  })

  test('maps the real top_provider', () => {
    // Unlike OpenRouter these are real numbers, not null — so `lookup.ts`'s
    // "prefer topProvider" path now has something to prefer.
    const model = parseNousModelsForTest({ data: [REAL_PERCEPTRON] })[0]
    expect(model?.topProvider).toEqual({
      contextLength: 36864,
      maxCompletionTokens: 8192,
      isModerated: false,
    })
  })

  test('coerces the real string pricing to a number', () => {
    const model = parseNousModelsForTest({ data: [REAL_PERCEPTRON] })[0]
    expect(model?.promptPricePerToken).toBe(0.00000015)
    expect(model?.completionPricePerToken).toBe(0.0000015)
  })

  test('a null nested instruct_type is omitted, never "null"', () => {
    const model = parseNousModelsForTest({ data: [REAL_PERCEPTRON] })[0]
    expect(model?.instructType).not.toBe('null')
    expect(model?.instructType).toBeUndefined()
  })

  test('a non-numeric price degrades to undefined, not NaN', () => {
    const model = parseNousModelsForTest({
      data: [{ id: 'x', pricing: { prompt: 'nope', completion: '' } }],
    })[0]
    expect(model?.promptPricePerToken).toBeUndefined()
    expect(model?.completionPricePerToken).toBeUndefined()
  })

  test('drops id-less rows and tolerates missing optional fields', () => {
    const models = parseNousModelsForTest({
      data: [{ id: '' }, { id: 42 }, {}, { id: 'bare' }],
    })
    expect(models.map((m) => m.id)).toEqual(['nous/bare'])
    const model = models[0]
    expect(model?.name).toBe('bare')
    expect(model?.modality).toBeUndefined()
    expect(model?.topProvider).toBeUndefined()
    expect(model?.promptPricePerToken).toBeUndefined()
  })

  test('an architecture object with no modality populates none of the three', () => {
    // The 9/417 residual: `architecture` present, `modality` absent. The
    // parser must degrade rather than invent a modality string.
    const model = parseNousModelsForTest({
      data: [{ id: 'partial', architecture: { tokenizer: 'Other' } }],
    })[0]
    expect(model?.modality).toBeUndefined()
    expect(model?.tokenizer).toBe('Other')
    expect(model?.instructType).toBeUndefined()
  })

  test('empty/missing data yields an empty catalog (degrade, not throw)', () => {
    expect(parseNousModelsForTest({})).toEqual([])
    expect(parseNousModelsForTest({ data: [] })).toEqual([])
  })
})
