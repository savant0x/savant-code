// FID-2026-0907-008 — APInex catalog parser pins.
// Upstream ids are vendor-namespaced WITH slashes (gpt/5.6-luna,
// free/glm-5.3-flash per apinex.bond/llms.txt); the parser prefixes the
// internal `apinex/` routing prefix exactly once and sorts stably.

import { describe, expect, test } from 'bun:test'

import { parseApinexModelsForTest } from '../openrouter-models/apinex'

describe('parseApinexCatalog (FID-2026-0907-008)', () => {
  test('prefixes vendor-slash upstream ids exactly once', () => {
    const models = parseApinexModelsForTest({
      data: [
        { id: 'gpt/5.6-luna', name: 'GPT 5.6 Luna' },
        { id: 'free/glm-5.3-flash', name: 'GLM 5.3 Flash' },
      ],
    })
    expect(models.map((m) => m.id)).toEqual([
      'apinex/free/glm-5.3-flash',
      'apinex/gpt/5.6-luna',
    ])
    expect(models.every((m) => m.provider === 'apinex')).toBe(true)
  })

  test('does not double-prefix an id that already carries the namespace', () => {
    const models = parseApinexModelsForTest({
      data: [{ id: 'apinex/gpt/5.6-luna' }],
    })
    expect(models[0]?.id).toBe('apinex/gpt/5.6-luna')
  })

  test('nested architecture fields stay unmapped (T96-followup probe 2026-09-28)', () => {
    // Measured live 2026-09-28 (HTTP 200, 34 models): this vendor serves no
    // `architecture.*` object and no flat modality/tokenizer/instruct_type
    // either — 0/34 in both positions. A nested read would map `undefined`
    // for every model (the FID-2026-0927-006 speculative-shape trap), so the
    // parser deliberately reads neither. If a vendor payload ever gains a
    // populated nested object, this leg is the tripwire that forces the
    // mapping decision back through a FID.
    const models = parseApinexModelsForTest({
      data: [
        {
          id: 'gpt/5.6-luna',
          architecture: { modality: 'text->text', tokenizer: 'GPT' },
          modality: 'text->text',
        } as Record<string, unknown>,
      ],
    })
    expect(models[0]?.modality).toBeUndefined()
    expect(models[0]?.tokenizer).toBeUndefined()
    expect(models[0]?.instructType).toBeUndefined()
  })

  test('skips entries without a usable id and tolerates unknown fields', () => {
    const models = parseApinexModelsForTest({
      data: [
        { name: 'no id here' },
        { id: 'grok/4.6', weight: 1, dollarsPer1M: 0.25, health: 'live' },
      ] as never,
    })
    expect(models.length).toBe(1)
    expect(models[0]?.id).toBe('apinex/grok/4.6')
  })

  test('empty or absent data degrades to an empty catalog', () => {
    expect(parseApinexModelsForTest({})).toEqual([])
    expect(parseApinexModelsForTest({ data: [] })).toEqual([])
  })
})
