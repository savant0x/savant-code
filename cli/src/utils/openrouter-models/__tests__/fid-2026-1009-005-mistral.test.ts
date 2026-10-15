/**
 * FID-2026-1009-005 — Mistral AI (api.mistral.ai) pins.
 *
 * Locks the live-catalog integration:
 * 1. The registry entry is a live, single-protocol, setup-available gateway
 *    on the probed OpenAI-compatible base URL.
 * 2. The dedicated parser maps `max_context_length` → contextLength — the
 *    shared parseChatCatalog reads `context_length` and would extract ZERO
 *    windows (the Vercel mis-parse class, measured 2026-10-09).
 * 3. The numeric `created` epoch normalizes through catalogCreated.
 * 4. No pricing fields exist on the wire — prices stay absent (truthful).
 * 5. The window-coverage disposition is `runtime-partial` (mixed roster).
 * 6. The exception manifest owns the `live-catalog` kind.
 */
import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { parseMistralModelsForTest } from '../mistral'

/** The measured Mistral `/v1/models` envelope shape (probe 2026-10-09). */
const PROBE_RESPONSE = {
  object: 'list',
  data: [
    {
      id: 'codestral-2508',
      object: 'model',
      created: 1791582665,
      owned_by: 'mistralai',
      capabilities: { completion_chat: true, function_calling: true },
      name: 'Codestral 25.08',
      description: 'Code model.',
      max_context_length: 262144,
      aliases: ['codestral-latest'],
      type: 'base',
    },
    {
      id: 'ministral-3b-2512',
      object: 'model',
      created: 1791582665,
      owned_by: 'mistralai',
      capabilities: { completion_chat: true },
      name: 'Ministral 3B 25.12',
      max_context_length: 131072,
      type: 'base',
    },
    {
      id: 'mistral-embed',
      object: 'model',
      created: 1791582665,
      owned_by: 'mistralai',
      name: 'Mistral Embed',
      type: 'base',
    },
  ],
}

describe('FID-2026-1009-005: mistral live catalog', () => {
  test('the parser maps max_context_length to contextLength', () => {
    const models = parseMistralModelsForTest(PROBE_RESPONSE)
    expect(models).toHaveLength(3)
    const byId = new Map(models.map((model) => [model.id, model]))
    // The shared parser reads context_length ?? context_window — neither
    // key exists on a Mistral row, so it would extract zero windows.
    expect(byId.get('mistral/codestral-2508')?.contextLength).toBe(262144)
    expect(byId.get('mistral/ministral-3b-2512')?.contextLength).toBe(131072)
    // A row without the field degrades to undefined, never a fabricated 0.
    expect(byId.get('mistral/mistral-embed')?.contextLength).toBeUndefined()
  })

  test('every id carries exactly one mistral/ routing prefix', () => {
    for (const model of parseMistralModelsForTest(PROBE_RESPONSE)) {
      expect(model.id.startsWith('mistral/')).toBe(true)
      expect(model.id.slice('mistral/'.length)).not.toContain('/')
      expect(model.provider).toBe('mistral')
    }
  })

  test('the numeric created epoch normalizes to an ISO string', () => {
    const models = parseMistralModelsForTest(PROBE_RESPONSE)
    for (const model of models) {
      expect(model.created).toBe(new Date(1791582665 * 1000).toISOString())
    }
  })

  test('no pricing fields exist on the wire — prices stay absent', () => {
    for (const model of parseMistralModelsForTest(PROBE_RESPONSE)) {
      expect(model.promptPricePerToken).toBeUndefined()
      expect(model.completionPricePerToken).toBeUndefined()
    }
  })

  test('name and description pass through; name falls back to the id', () => {
    const models = parseMistralModelsForTest(PROBE_RESPONSE)
    const byId = new Map(models.map((model) => [model.id, model]))
    expect(byId.get('mistral/codestral-2508')?.name).toBe('Codestral 25.08')
    expect(byId.get('mistral/codestral-2508')?.description).toBe('Code model.')
    expect(byId.get('mistral/ministral-3b-2512')?.name).toBe(
      'Ministral 3B 25.12',
    )
  })

  test('a malformed envelope degrades to an empty list, never throws', () => {
    expect(parseMistralModelsForTest({})).toEqual([])
    expect(parseMistralModelsForTest({ data: 'not-an-array' })).toEqual([])
    expect(parseMistralModelsForTest({ data: [null, 42, {}] })).toEqual([])
  })

  test('registry entry is a live single-protocol setup-available gateway', () => {
    const entry = PROVIDER_REGISTRY.mistral
    expect(entry.id).toBe('mistral')
    expect(entry.label).toBe('Mistral AI')
    expect(entry.kind).toBe('gateway')
    expect(entry.setupAvailable).toBe(true)
    expect(entry.credentials.envVar).toBe('MISTRAL_API_KEY')
    expect(entry.baseUrl).toBe('https://api.mistral.ai/v1')
    expect(entry.protocol).toBe('openai')
    expect(entry.idTransform).toBe('strip')
    expect(entry.catalog).toEqual({
      source: 'live',
      url: 'https://api.mistral.ai/v1/models',
    })
    expect(entry.domain).toBe('mistral.ai')
    expect(entry.order).toBe(4)
  })

  test('window-coverage register declares the runtime-partial disposition', () => {
    expect(WINDOW_COVERAGE_REGISTER.get('mistral')?.disposition).toBe(
      'runtime-partial',
    )
  })

  test('the exception manifest owns the live-catalog kind', () => {
    const owned = PROVIDER_EXCEPTION_MANIFEST.filter(
      (entry) => entry.providerId === 'mistral',
    )
    expect(owned).toHaveLength(1)
    expect(owned[0].kinds).toEqual(['live-catalog'])
    expect(owned[0].owner).toBe('cli/src/utils/openrouter-models/mistral.ts')
  })
})
