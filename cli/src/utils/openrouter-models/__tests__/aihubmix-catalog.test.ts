/**
 * FID-2026-1013-004 — AIHubMix rich live-catalog pins.
 *
 * Locks the measured `/api/v1/models` contract: model_id routing, exact llm
 * type-token filtering, sparse endpoints tolerance, positive limit mapping,
 * runtime-partial coverage, exception ownership, and the settled ladder slot.
 */
import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { parseAihubmixModelsForTest } from '../aihubmix'
import { resolveGatewayLiveCatalogs } from '../gateway-live-results'

import type { OpenRouterModel } from '../types'

const PROBE_RESPONSE = {
  data: [
    {
      model_id: 'coding-glm-5.3-flash-free',
      model_name: 'Coding GLM 5.3 Flash (free)',
      desc: 'Coding model.',
      types: 'llm',
      features: 'thinking,tools,function_calling,structured_outputs',
      endpoints: '',
      context_length: 1_000_000,
      max_output: 131_072,
    },
    {
      model_id: 'multimodal-llm',
      model_name: 'Multimodal LLM',
      types: 'image_generation,llm',
      features: '',
      endpoints: '',
      context_length: 0,
      max_output: 0,
    },
    {
      model_id: 'decision-llm',
      types: 'llm,decision',
      endpoints: 'chat_completions',
      context_length: 128_000,
      max_output: null,
    },
    { model_id: 'not-llm', types: 'image_generation' },
    { model_id: 'substring-not-llm', types: 'llmish' },
    { model_id: 42, types: 'llm' },
  ],
}

const row = (id: string): OpenRouterModel => ({
  id,
  name: id,
  provider: 'aihubmix',
})

describe('FID-2026-1013-004: AIHubMix live catalog', () => {
  test('keeps exact llm rows even when endpoints is empty', () => {
    const models = parseAihubmixModelsForTest(PROBE_RESPONSE)
    expect(models).toHaveLength(3)
    const byId = new Map(models.map((model) => [model.id, model]))
    expect(byId.get('aihubmix/coding-glm-5.3-flash-free')).toEqual(
      expect.objectContaining({
        name: 'Coding GLM 5.3 Flash (free)',
        description: 'Coding model.',
        contextLength: 1_000_000,
        maxCompletionTokens: 131_072,
        capabilities: [
          'thinking',
          'tools',
          'function_calling',
          'structured_outputs',
        ],
      }),
    )
    expect(byId.get('aihubmix/multimodal-llm')).toEqual(
      expect.objectContaining({
        contextLength: undefined,
        maxCompletionTokens: undefined,
      }),
    )
    expect(byId.get('aihubmix/decision-llm')?.contextLength).toBe(128_000)
    expect(
      byId.get('aihubmix/decision-llm')?.maxCompletionTokens,
    ).toBeUndefined()
  })

  test('filters non-LLM rows by exact comma-delimited type token', () => {
    const models = parseAihubmixModelsForTest(PROBE_RESPONSE)
    expect(models.map((model) => model.id)).not.toContain('aihubmix/not-llm')
    expect(models.map((model) => model.id)).not.toContain(
      'aihubmix/substring-not-llm',
    )
  })

  test('prefixes every accepted id once and sorts the catalog', () => {
    const models = parseAihubmixModelsForTest(PROBE_RESPONSE)
    expect(models.map((model) => model.id)).toEqual([
      'aihubmix/coding-glm-5.3-flash-free',
      'aihubmix/decision-llm',
      'aihubmix/multimodal-llm',
    ])
    expect(models.every((model) => model.provider === 'aihubmix')).toBe(true)
  })

  test('malformed envelopes and rows degrade to an empty list', () => {
    expect(parseAihubmixModelsForTest({})).toEqual([])
    expect(parseAihubmixModelsForTest({ data: 'not-an-array' })).toEqual([])
    expect(parseAihubmixModelsForTest({ data: [null, 42, {}] })).toEqual([])
  })

  test('registry entry is a live single-protocol setup gateway carrying the APP-Code', () => {
    expect(PROVIDER_REGISTRY.aihubmix).toEqual({
      id: 'aihubmix',
      label: 'AIHubMix',
      kind: 'gateway',
      credentials: { envVar: 'AIHUBMIX_API_KEY' },
      baseUrl: 'https://aihubmix.com/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: {
        source: 'live',
        url: 'https://aihubmix.com/api/v1/models',
      },
      // Documented carrier code: a standing 10% discount, sent on every
      // inference request (FID-2026-1013-004).
      extraHeaders: { 'APP-Code': 'MFSO2605' },
      setupAvailable: true,
      domain: 'aihubmix.com',
      order: 4,
    })
  })

  test('window coverage is runtime-partial', () => {
    expect(WINDOW_COVERAGE_REGISTER.get('aihubmix')?.disposition).toBe(
      'runtime-partial',
    )
  })

  test('the exception manifest owns the live-catalog kind', () => {
    const owned = PROVIDER_EXCEPTION_MANIFEST.filter(
      (entry) => entry.providerId === 'aihubmix',
    )
    expect(owned).toHaveLength(1)
    expect(owned[0].kinds).toEqual(['live-catalog'])
    expect(owned[0].owner).toBe('cli/src/utils/openrouter-models/aihubmix.ts')
  })

  test('the settled ladder keeps AIHubMix between Apixo and custom catalogs', () => {
    const xkiroRow = row('xkiro/neighbor')
    const apixoRow = row('apixo/neighbor')
    const aihubmixRow = row('aihubmix/neighbor')
    const fulfilled = (value: OpenRouterModel[]) =>
      ({ status: 'fulfilled', value }) as const
    const restResults = [
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([xkiroRow]),
      fulfilled([apixoRow]),
      fulfilled([aihubmixRow]),
      fulfilled([]),
    ]
    const resolved = resolveGatewayLiveCatalogs(
      fulfilled([]),
      fulfilled([]),
      restResults,
    )
    expect(resolved.xkiroModels).toEqual([xkiroRow])
    expect(resolved.apixoModels).toEqual([apixoRow])
    expect(resolved.aihubmixModels).toEqual([aihubmixRow])
    expect(resolved.customModels).toEqual([])
  })
})
