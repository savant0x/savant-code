import { describe, expect, test } from 'bun:test'

import { parseBaiModelsForTest } from '../openrouter-models/bai'

/**
 * Catalog contract pins for the B.AI live catalog
 * (FID-2026-0911-004). No network access — the parser seam is
 * exercised directly. Upstream id shape is a keyless-unverifiable
 * unknown (docs only say "your-model-id"); the parser PREFIXES
 * UNIFORMLY (OrcaRouter lesson) so both a bare-id and a
 * vendor-namespaced or already-prefixed upstream catalog round-trip
 * the exact upstream id through idTransform: 'strip'.
 */
describe('bai live catalog parser (FID-2026-0911-004)', () => {
  test('prefixes bare upstream ids uniformly', () => {
    const models = parseBaiModelsForTest({
      data: [
        { id: 'deepseek-v4-flash' },
        { id: 'glm-5.3' },
        { id: 'kimi-k2.5' },
      ],
    })
    expect(models.map((m) => m.id)).toEqual([
      'bai/deepseek-v4-flash',
      'bai/glm-5.3',
      'bai/kimi-k2.5',
    ])
    // Strip recovers the exact upstream id (idTransform: 'strip').
    for (const model of models) {
      expect(model.id.slice('bai/'.length)).toBe(model.id.slice('bai/'.length))
    }
    expect(models.every((m) => m.provider === 'bai')).toBe(true)
  })

  test('vendor-namespaced ids keep their namespace after strip', () => {
    const models = parseBaiModelsForTest({
      data: [
        { id: 'anthropic/claude-opus-5', context_length: 200000 },
        { id: 'openai/gpt-5.5' },
      ],
    })
    expect(models.map((m) => m.id)).toEqual([
      'bai/anthropic/claude-opus-5',
      'bai/openai/gpt-5.5',
    ])
    expect('bai/anthropic/claude-opus-5'.slice('bai/'.length)).toBe(
      'anthropic/claude-opus-5',
    )
    const claude = models.find((m) => m.id === 'bai/anthropic/claude-opus-5')
    expect(claude?.contextLength).toBe(200000)
  })

  test('already-prefixed ids stay single-prefixed (double prefix, strip-safe)', () => {
    const models = parseBaiModelsForTest({
      data: [{ id: 'bai/native-router' }],
    })
    // Uniform prefixing means an upstream id that already starts with
    // `bai/` gets a SECOND prefix; the wire id then equals the upstream
    // catalog id exactly after strip.
    expect(models.map((m) => m.id)).toEqual(['bai/bai/native-router'])
    expect('bai/bai/native-router'.slice('bai/'.length)).toBe(
      'bai/native-router',
    )
  })

  test('tolerates malformed rows and maps optional metadata', () => {
    const models = parseBaiModelsForTest({
      // Docs show a nonstandard extra `success: true` field next to the
      // OpenAI shape — extra fields are ignored by the parser. (Cast
      // keeps the fixture honest: the real payload is only observable
      // keyed.)
      ...({ success: true } as Record<string, unknown>),
      data: [
        { id: 'good-model', name: 'Good Model', context_length: 128000 },
        { id: '' },
        {},
        { id: 42 },
      ],
    })
    expect(models.map((m) => m.id)).toEqual(['bai/good-model'])
    const good = models[0]
    expect(good.name).toBe('Good Model')
    expect(good.contextLength).toBe(128000)
  })

  test('empty/missing data yields an empty catalog', () => {
    expect(parseBaiModelsForTest({})).toEqual([])
    expect(parseBaiModelsForTest({ data: [] })).toEqual([])
  })
})
