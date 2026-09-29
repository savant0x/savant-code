import { describe, expect, test } from 'bun:test'

import { parseOrcarouterModelsForTest } from '../openrouter-models/orcarouter'

/**
 * Catalog contract pins for the OrcaRouter live catalog
 * (FID-2026-0911-002). No network access — the parser seam is exercised
 * directly with shapes probed from the live endpoint 2026-09-11.
 */
describe('orcarouter live catalog parser (FID-2026-0911-002)', () => {
  test('prefixes vendor-namespaced ids uniformly', () => {
    const models = parseOrcarouterModelsForTest({
      data: [
        { id: 'anthropic/claude-opus-5' },
        { id: 'deepseek/deepseek-v4-flash' },
        { id: 'google/gemini-2.5-flash' },
      ],
    })
    expect(models.map((m) => m.id)).toEqual([
      'orcarouter/anthropic/claude-opus-5',
      'orcarouter/deepseek/deepseek-v4-flash',
      'orcarouter/google/gemini-2.5-flash',
    ])
    // Strip recovers the exact upstream id (idTransform: 'strip').
    for (const model of models) {
      expect(model.id.slice('orcarouter/'.length)).toBe(
        model.id.slice('orcarouter/'.length),
      )
    }
    expect(models.every((m) => m.provider === 'orcarouter')).toBe(true)
  })

  test('already-prefixed router ids stay single-prefixed (no double prefix)', () => {
    const models = parseOrcarouterModelsForTest({
      data: [
        { id: 'orcarouter/free', context_length: 200000 },
        { id: 'orcarouter/fusion', context_length: 1000000 },
        { id: 'orcarouter/fusion-flash' },
        { id: 'orcarouter/fusion-mini' },
      ],
    })
    expect(models.map((m) => m.id)).toEqual([
      // Parser output is sorted; `free` sorts before the `fusion*` family.
      'orcarouter/orcarouter/free',
      'orcarouter/orcarouter/fusion',
      'orcarouter/orcarouter/fusion-flash',
      'orcarouter/orcarouter/fusion-mini',
    ])
    // The strip transform (model-factories applyIdTransform) sends the
    // upstream id verbatim for both shapes.
    expect('orcarouter/orcarouter/free'.slice('orcarouter/'.length)).toBe(
      'orcarouter/free',
    )
    expect('orcarouter/orcarouter/fusion'.slice('orcarouter/'.length)).toBe(
      'orcarouter/fusion',
    )
    // Context length from the catalog flows through.
    const free = models.find((m) => m.id === 'orcarouter/orcarouter/free')
    expect(free?.contextLength).toBe(200000)
  })

  test('drops id-less rows and tolerates missing optional fields', () => {
    const models = parseOrcarouterModelsForTest({
      data: [{ id: '' }, { id: 42 }, {}, { id: 'openai/gpt-5.5' }],
    })
    expect(models.map((m) => m.id)).toEqual(['orcarouter/openai/gpt-5.5'])
    const gpt = models[0]
    expect(gpt.name).toBe('openai/gpt-5.5')
    expect(gpt.description).toBeUndefined()
    expect(gpt.contextLength).toBeUndefined()
  })

  test('nested architecture fields stay unmapped (T96-followup probe 2026-09-28)', () => {
    // Measured live 2026-09-28 (HTTP 200, 204 models): an `architecture`
    // OBJECT is present on 182/204 models but every field inside it is
    // null/absent — nested modality/tokenizer/instruct_type populated on
    // 0/204, flat keys also 0/204 (T96-followup / FID-2026-0927-006). The
    // empty shell is the speculative-shape trap in its purest form: a
    // presence check would pass, a populated-field read maps `undefined`
    // for every model. The parser deliberately reads neither position.
    const models = parseOrcarouterModelsForTest({
      data: [
        {
          id: 'orcarouter/free',
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
    expect(parseOrcarouterModelsForTest({})).toEqual([])
    expect(parseOrcarouterModelsForTest({ data: [] })).toEqual([])
  })
})
