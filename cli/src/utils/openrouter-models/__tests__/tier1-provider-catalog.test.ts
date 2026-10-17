/** FID-2026-1012-026 — first-party provider catalog and ladder pins. */
import { TIER1_MODEL_ROWS } from '@savant-code/common/constants/model-config/tier1'
import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { isCodingHarnessModel } from '../catalog-filter'
import { parseDeepInfraModelsForTest } from '../deepinfra'
import { resolveGatewayLiveCatalogs } from '../gateway-live-results'
import { parseVeniceModelsForTest } from '../venice'

import type { OpenRouterModel } from '../types'

const deepInfraResponse = {
  data: [
    { id: 'zai-org/GLM-5.3', name: 'GLM-5.3' },
    { id: 'MiniMaxAI/MiniMax-M3', name: 'MiniMax-M3' },
    { id: 'Qwen/Qwen3-VL-235B-A22B-Instruct', name: 'Qwen3 VL' },
    { id: 42 },
  ],
}

const veniceResponse = {
  data: [
    {
      id: 'grok-4.7',
      name: 'Grok 4.7',
      context_length: 500000,
      created: 1790773175,
    },
    {
      id: 'grok-imagine-image',
      name: 'Grok Imagine Image',
      context_length: 16000,
    },
    { id: 'broken-row', context_length: null },
  ],
}

const fulfilled = (value: OpenRouterModel[]) =>
  ({ status: 'fulfilled', value }) as const

describe('FID-2026-1012-026: Tier 1 first-party catalogs', () => {
  test('DeepInfra preserves vendor namespaces after one routing prefix', () => {
    const models = parseDeepInfraModelsForTest(deepInfraResponse)
    expect(models.map((model) => model.id)).toEqual([
      'deepinfra/MiniMaxAI/MiniMax-M3',
      'deepinfra/zai-org/GLM-5.3',
    ])
    expect(models.every((model) => model.provider === 'deepinfra')).toBe(true)
  })

  test('Venice maps the measured context_length field', () => {
    const models = parseVeniceModelsForTest(veniceResponse)
    expect(models).toHaveLength(2)
    expect(models[1]).toEqual(
      expect.objectContaining({
        id: 'venice/grok-4.7',
        contextLength: 500000,
        provider: 'venice',
      }),
    )
    expect(models[0]?.contextLength).toBeUndefined()
  })

  test('registry and window coverage carry both public catalog contracts', () => {
    expect(PROVIDER_REGISTRY.deepinfra.catalog).toEqual({
      source: 'live',
      url: 'https://api.deepinfra.com/v1/models',
    })
    expect(PROVIDER_REGISTRY.venice.catalog).toEqual({
      source: 'live',
      url: 'https://api.venice.ai/api/v1/models',
    })
    expect(WINDOW_COVERAGE_REGISTER.get('deepinfra')?.disposition).toBe(
      'table-section',
    )
    expect(WINDOW_COVERAGE_REGISTER.get('venice')?.disposition).toBe(
      'runtime-published',
    )
    for (const provider of ['deepinfra', 'venice']) {
      const entry = PROVIDER_EXCEPTION_MANIFEST.find(
        (candidate) => candidate.providerId === provider,
      )
      expect(entry?.kinds).toEqual(['live-catalog'])
    }
  })

  test('static Tier 1 rows exclude non-coding modality catalogs', () => {
    const incompatibleRows = TIER1_MODEL_ROWS.filter(
      ([id, name]) => !isCodingHarnessModel(id, name),
    )
    expect(incompatibleRows).toEqual([])
  })

  test('settled ladder keeps DeepInfra, Venice, and Ashna before custom catalogs', () => {
    const deepinfraRow: OpenRouterModel = {
      id: 'deepinfra/zai-org/GLM-5.3',
      name: 'GLM-5.3',
      provider: 'deepinfra',
    }
    const veniceRow: OpenRouterModel = {
      id: 'venice/grok-4.7',
      name: 'Grok 4.7',
      provider: 'venice',
    }
    const customRow: OpenRouterModel = {
      id: 'custom/last',
      name: 'last',
      provider: 'custom',
    }
    // FID-2026-1016-018: Ashna joins at slot 15; the custom-catalogs tail
    // stays last (slot 16).
    const ashnaRow: OpenRouterModel = {
      id: 'ashna/gpt-5.5',
      name: 'gpt-5.5',
      provider: 'ashna',
    }
    const restResults = Array.from({ length: 17 }, () => fulfilled([]))
    restResults[13] = fulfilled([deepinfraRow])
    restResults[14] = fulfilled([veniceRow])
    restResults[15] = fulfilled([ashnaRow])
    restResults[16] = fulfilled([customRow])
    const resolved = resolveGatewayLiveCatalogs(
      fulfilled([]),
      fulfilled([]),
      restResults,
    )
    expect(resolved.deepinfraModels).toEqual([deepinfraRow])
    expect(resolved.veniceModels).toEqual([veniceRow])
    expect(resolved.ashnaModels).toEqual([ashnaRow])
    expect(resolved.customModels).toEqual([customRow])
  })
})
