/**
 * FID-2026-1016-018 — Ashna (api.ashna.ai) pins.
 *
 * Locks the live-catalog integration:
 * 1. The registry entry is a live, single-protocol, setup-available KEYED
 *    gateway (`openai` on the documented `/v1/api` root) with the operator's
 *    credential name (`ASHNA_API_KEY`) — the Nous/CleanAPIs pattern, since
 *    the endpoint measured 401 keyless (2026-10-16).
 * 2. The dedicated parser maps the measured list shape
 *    `{id, object, created(epoch), owned_by}`: id → routing+, name → the
 *    upstream id (rows carry no name field), created → ISO, NO windows (the
 *    vendor publishes none).
 * 3. The vendor's own retrieval/image products ride the same model list;
 *    they are excluded locally (`voyage-`, `rerank-`, `ashna-diffusion-`)
 *    with the shared harness filter as drift defense.
 * 4. The window-coverage disposition is `table-section` with cross-gateway
 *    consensus rows; the two-group minimums are pinned here so a re-edit
 *    cannot launder them back to the family reading.
 * 5. The exception manifest owns the `live-catalog` kind.
 * 6. The settled ladder resolves the Ashna leg in the Ashna slot — inserted
 *    before the custom-catalogs tail, after venice (FID-2026-1016-018).
 */
import { ASHNA_CONTEXT_WINDOW_FALLBACKS } from '@savant-code/common/constants/context-window-table-ashna'
import { WINDOW_COVERAGE_REGISTER } from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { parseAshnaModelsForTest } from '../ashna'
import { resolveGatewayLiveCatalogs } from '../gateway-live-results'

import type { OpenRouterModel } from '../types'

/** The measured Ashna `/v1/api/models` envelope shape (probe 2026-10-16). */
const PROBE_RESPONSE = {
  data: [
    {
      id: 'gpt-5.5',
      object: 'model',
      created: 1767132058,
      owned_by: 'openai',
    },
    {
      id: 'claude-sonnet-5',
      object: 'model',
      created: 1767132058,
      owned_by: 'anthropic',
    },
    // Vendor retrieval/image products ride the same endpoint (measured).
    {
      id: 'voyage-3',
      object: 'model',
      created: 1700000000,
      owned_by: 'voyageai',
    },
    {
      id: 'rerank-2.5',
      object: 'model',
      created: 1700000000,
      owned_by: 'voyageai',
    },
    {
      id: 'ashna-diffusion-1',
      object: 'model',
      created: 1700000000,
      owned_by: 'ashna',
    },
    // The shared modality-naming filter stays as drift defense.
    {
      id: 'whisper-1',
      object: 'model',
      created: 1700000000,
      owned_by: 'openai',
    },
  ],
}

const row = (id: string): OpenRouterModel => ({
  id,
  name: id,
  provider: 'ashna',
})

describe('FID-2026-1016-018: ashna live catalog', () => {
  test('the parser maps the measured list shape with no window extraction', () => {
    const models = parseAshnaModelsForTest(PROBE_RESPONSE)
    expect(models).toHaveLength(2)
    const byId = new Map(models.map((model) => [model.id, model]))
    // Rows carry no name field: the upstream id is the honest label.
    expect(byId.get('ashna/gpt-5.5')?.name).toBe('gpt-5.5')
    // Numeric epoch `created` normalizes to an ISO string.
    expect(byId.get('ashna/gpt-5.5')?.created).toBe(
      new Date(1767132058 * 1000).toISOString(),
    )
    // Ashna publishes NO window fields — contextLength stays undefined so
    // the exact-best lookup falls to the fallback table, never to a zero.
    expect(byId.get('ashna/claude-sonnet-5')?.contextLength).toBeUndefined()
    expect(
      byId.get('ashna/claude-sonnet-5')?.maxCompletionTokens,
    ).toBeUndefined()
  })

  test('every id carries exactly one ashna/ routing prefix', () => {
    for (const model of parseAshnaModelsForTest(PROBE_RESPONSE)) {
      expect(model.id.startsWith('ashna/')).toBe(true)
      expect(model.id.slice('ashna/'.length)).not.toContain('/')
      expect(model.provider).toBe('ashna')
    }
  })

  test('the vendor retrieval/image ids are excluded locally', () => {
    const models = parseAshnaModelsForTest(PROBE_RESPONSE)
    const ids = new Set(models.map((model) => model.id))
    // `voyage-`/`rerank-` name no modality in the id — the shared filter
    // cannot see them; the local prefix exclusion is the honest census.
    expect(ids.has('ashna/voyage-3')).toBe(false)
    expect(ids.has('ashna/rerank-2.5')).toBe(false)
    expect(ids.has('ashna/ashna-diffusion-1')).toBe(false)
    // The shared harness filter remains as drift defense for future rows.
    expect(ids.has('ashna/whisper-1')).toBe(false)
    // Bare chat aliases (auto/sonnet/haiku/opus) are chat-serviceable ids —
    // they stay, labelled as themselves.
    const aliasProbe = parseAshnaModelsForTest({
      data: [{ id: 'auto', object: 'model', created: 1, owned_by: 'ashna' }],
    })
    expect(aliasProbe.map((model) => model.id)).toEqual(['ashna/auto'])
  })

  test('a malformed envelope degrades to an empty list, never throws', () => {
    expect(parseAshnaModelsForTest({})).toEqual([])
    expect(parseAshnaModelsForTest({ data: 'not-an-array' })).toEqual([])
    expect(parseAshnaModelsForTest({ data: [null, 42, {}] })).toEqual([])
  })

  test('registry entry is a keyed live single-protocol setup-available gateway', () => {
    expect(PROVIDER_REGISTRY.ashna).toEqual({
      id: 'ashna',
      label: 'Ashna',
      kind: 'gateway',
      credentials: {
        envVar: 'ASHNA_API_KEY',
        missingKeyMessage:
          'Ashna API key not set. Set ASHNA_API_KEY environment variable or run /provider ashna.',
      },
      baseUrl: 'https://api.ashna.ai/v1/api',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'live', url: 'https://api.ashna.ai/v1/api/models' },
      setupAvailable: true,
      domain: 'ashna.ai',
      order: 4,
    })
  })

  test('window-coverage register declares the table-section disposition', () => {
    expect(WINDOW_COVERAGE_REGISTER.get('ashna')?.disposition).toBe(
      'table-section',
    )
    // The consensus rows are the source of truth; the two-group minimum
    // decisions are pinned so a re-edit cannot lift them back up.
    expect(ASHNA_CONTEXT_WINDOW_FALLBACKS.length).toBeGreaterThanOrEqual(20)
    const byKey = new Map(ASHNA_CONTEXT_WINDOW_FALLBACKS)
    for (const key of byKey.keys()) {
      expect(key.startsWith('ashna/')).toBe(true)
    }
    expect(byKey.get('ashna/gpt-5.5')).toBe(1_050_000)
    expect(byKey.get('ashna/gpt-6.1-sol')).toBe(1_050_000)
    expect(byKey.get('ashna/gpt-5.3-codex')).toBe(400_000)
    expect(byKey.get('ashna/gpt-oss-120b')).toBe(131_072)
    expect(byKey.get('ashna/claude-opus-4-8')).toBe(1_000_000)
    expect(byKey.get('ashna/claude-haiku-4-5')).toBe(200_000)
    expect(byKey.get('ashna/deepseek-v4-flash')).toBe(1_048_576)
    expect(byKey.get('ashna/kimi-k3')).toBe(1_048_576)
    // Two ≥2-row groups disagree: the documented minimum, not the family
    // maximum.
    expect(byKey.get('ashna/glm-5.3')).toBe(1_000_000)
    expect(byKey.get('ashna/glm-5.2')).toBe(1_000_000)
    expect(byKey.get('ashna/glm-5.3-flash')).toBe(1_048_575)
  })

  test('the exception manifest owns the live-catalog kind', () => {
    const owned = PROVIDER_EXCEPTION_MANIFEST.filter(
      (entry) => entry.providerId === 'ashna',
    )
    expect(owned).toHaveLength(1)
    expect(owned[0].kinds).toEqual(['live-catalog'])
    expect(owned[0].owner).toBe('cli/src/utils/openrouter-models/ashna.ts')
  })

  test('the settled ladder resolves the Ashna leg in the Ashna slot', () => {
    const ashnaRow = row('ashna/gpt-5.5')
    const neighbourRow = row('xkiro/some-model')
    const fulfilled = (value: OpenRouterModel[]) =>
      ({ status: 'fulfilled', value }) as const
    // The positional contract: nous, kiosapi, apinex, openai, orcarouter,
    // B.AI, vercel, cleanapis, codecraft, mistral, xkiro, apixo, AIHubMix,
    // deepinfra, venice, ASHNA, custom.
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
      fulfilled([neighbourRow]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([]),
      fulfilled([ashnaRow]),
      fulfilled([]),
      fulfilled([]),
    ]
    const resolved = resolveGatewayLiveCatalogs(
      fulfilled([]),
      fulfilled([]),
      restResults,
    )
    expect(resolved.ashnaModels).toEqual([ashnaRow])
    // The neighbour slots are unaffected — the shift this pins against.
    expect(resolved.xkiroModels).toEqual([neighbourRow])
    expect(resolved.veniceModels).toEqual([])
    expect(resolved.customModels).toEqual([])
  })
})
