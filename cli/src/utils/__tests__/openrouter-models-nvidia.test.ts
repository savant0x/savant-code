import { describe, expect, test } from 'bun:test'

import { parseNvidiaModelsForTest } from '../openrouter-models/nvidia'

/**
 * Catalog contract pins for the NVIDIA NIM live catalog
 * (FID-2026-0809-001 Phase 3). No network access — the parser seam is
 * exercised directly with the shape probed from the live endpoint
 * 2026-09-28 (HTTP 200, 81 models, keyless OpenAI list shape:
 * `data: [{ id }]` only).
 */
describe('nvidia live catalog parser (FID-2026-0809-001)', () => {
  test('prefixes bare ids uniformly and uses the id as the name', () => {
    const models = parseNvidiaModelsForTest({
      data: [
        { id: '01-ai/yi-large' },
        { id: 'deepseek/deepseek-v4' },
        { id: 'meta/llama-3.3-70b-instruct' },
      ],
    })
    expect(models.map((m) => m.id)).toEqual([
      'nvidia/01-ai/yi-large',
      'nvidia/deepseek/deepseek-v4',
      'nvidia/meta/llama-3.3-70b-instruct',
    ])
    expect(models.every((m) => m.provider === 'nvidia')).toBe(true)
    expect(models[0]?.name).toBe('01-ai/yi-large')
  })

  test('drops id-less rows and degrades to an empty catalog, not throw', () => {
    expect(parseNvidiaModelsForTest({})).toEqual([])
    expect(parseNvidiaModelsForTest({ data: [] })).toEqual([])
    expect(
      parseNvidiaModelsForTest({ data: [{}, { id: '' }, { id: 'm' }] }),
    ).toEqual([{ id: 'nvidia/m', name: 'm', provider: 'nvidia' }])
  })

  test('nested architecture fields stay unmapped (T96-followup probe 2026-09-28)', () => {
    // Measured live 2026-09-28 (HTTP 200, 81 models): no `architecture.*`
    // object and no flat modality/tokenizer/instruct_type — 0/81 in both
    // positions (T96-followup / FID-2026-0927-006). A nested read would
    // populate nothing for every model; this leg is the tripwire that
    // forces any future mapping decision back through a FID.
    const models = parseNvidiaModelsForTest({
      data: [
        {
          id: '01-ai/yi-large',
          architecture: { modality: 'text->text', tokenizer: 'Other' },
          modality: 'text->text',
        } as { id?: string } & Record<string, unknown>,
      ],
    })
    expect(models[0]?.modality).toBeUndefined()
    expect(models[0]?.tokenizer).toBeUndefined()
    expect(models[0]?.instructType).toBeUndefined()
  })
})
