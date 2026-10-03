import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'bun:test'

import {
  catalogSearch,
  describeEndpoint,
  executeEndpoint,
  loadLaunchBundle,
} from '../runtime'

/**
 * Catalog tool-surface suite (FID-2026-0930-003 gate): the checked-in
 * compiled bundle loads and the tool-facing runtime entry serves
 * `connector_search` / `connector_describe` / `connector_invoke` (replay,
 * zero network). The tinyfish replay settles `{credits:{},evidence:{}}`
 * through the FREE model — the same offline gate the FID declares.
 */

/** fixture path helper — fileURLToPath, not .pathname (Windows drive letters). */
function fixturePath(rel: string): string {
  return fileURLToPath(new URL(rel, import.meta.url))
}

describe('launch bundle', () => {
  test('loads and validates the checked-in catalog.json', async () => {
    const bundle = await loadLaunchBundle()
    expect(Object.keys(bundle.providers).sort()).toEqual([
      'exa',
      'firecrawl',
      'tinyfish',
    ])
    expect(Object.keys(bundle.endpoints).length).toBeGreaterThanOrEqual(8)
  })

  test('search with no filter lists providers; with a filter lists endpoints', async () => {
    const bundle = await loadLaunchBundle()
    const providers = catalogSearch(bundle, {})
    expect(providers).toHaveProperty('providers')
    if ('providers' in providers) {
      const names = providers.providers.map((p) => p.name).sort()
      expect(names).toEqual(['exa', 'firecrawl', 'tinyfish'])
    }

    const endpoints = catalogSearch(bundle, { provider: 'firecrawl' })
    expect(endpoints).toHaveProperty('endpoints')
    if ('endpoints' in endpoints) {
      expect(endpoints.endpoints.length).toBeGreaterThan(0)
      for (const endpoint of endpoints.endpoints) {
        expect(endpoint.id.startsWith('firecrawl#')).toBe(true)
      }
    }

    const queried = catalogSearch(bundle, { query: 'scrape' })
    expect(queried).toHaveProperty('endpoints')
    if ('endpoints' in queried) {
      expect(
        queried.endpoints.some(
          (endpoint) => endpoint.id === 'firecrawl#scrape',
        ),
      ).toBe(true)
    }
  })
})

describe('describeEndpoint (the doc IS the contract)', () => {
  test('returns the tinyfish search doc with its input schema', async () => {
    const bundle = await loadLaunchBundle()
    const doc = describeEndpoint(bundle, 'tinyfish', 'tinyfish#search')
    expect(doc.provider).toBe('tinyfish')
    expect(doc.id).toBe('tinyfish#search')
    expect(doc.request.method).toBe('GET')
    expect(doc.request.url).toBe('https://api.search.tinyfish.ai/')
    expect(doc.input.schema.queryParams).toBeDefined()
  })

  test('unknown endpoint fails with the known-id list', async () => {
    const bundle = await loadLaunchBundle()
    expect(() => describeEndpoint(bundle, 'tinyfish', 'tinyfish#nope')).toThrow(
      /endpoint not in bundle/,
    )
  })

  test('a provider/endpoint mismatch fails rather than executing under the wrong vendor identity', async () => {
    const bundle = await loadLaunchBundle()
    expect(() =>
      describeEndpoint(bundle, 'firecrawl', 'tinyfish#search'),
    ).toThrow(/belongs to provider/)
  })
})

describe('executeEndpoint replay (zero network)', () => {
  test('tinyfish#search replay settles {credits:{}, evidence:{}} (FREE model)', async () => {
    const bundle = await loadLaunchBundle()
    // The tool-facing entry resolves credentials through the REAL env seam
    // (envParamsResolver at egress) — the replay never touches the network,
    // but the credential presence check is live. Supply it, then restore.
    const envKey = 'TINYFISH_CREDENTIALS_API_KEY'
    const hadKey = process.env[envKey] !== undefined
    const originalKey = process.env[envKey]
    process.env[envKey] = 'test-key'
    try {
      await runReplay(bundle)
    } finally {
      if (hadKey) process.env[envKey] = originalKey
      else delete process.env[envKey]
    }
  })

  async function runReplay(
    bundle: Awaited<ReturnType<typeof loadLaunchBundle>>,
  ) {
    // The recorded chain the engine-replay suite uses — served by the
    // runtime's own structural replay, zero network.
    const raw = JSON.parse(
      await readFile(
        fixturePath(
          '../connectors/tinyfish/endpoints/search/fixtures/synthetic-happy.json',
        ),
        'utf8',
      ),
    ) as { calls: unknown[] }
    const recorded = {
      kind: 'fixture' as const,
      load: async () => raw,
      path: 'tinyfish/search/synthetic-happy.json',
    }
    const result = await executeEndpoint({
      bundle,
      provider: 'tinyfish',
      endpoint: 'tinyfish#search',
      input: {
        queryParams: {
          query: 'NVIDIA Q4 FY2025 revenue',
          domain_type: 'news',
        },
      },
      mode: 'replay',
      fixture: recorded,
    })
    expect(result.httpStatus).toBe(200)
    expect(result.usage).toEqual({ credits: {}, evidence: {} })
    const output = result.output as Record<string, unknown>
    expect((output.results as unknown[]).length).toBe(2)
  }

  test('replay mode without a fixture source is refused', async () => {
    const bundle = await loadLaunchBundle()
    expect(
      executeEndpoint({
        bundle,
        provider: 'tinyfish',
        endpoint: 'tinyfish#search',
        input: { queryParams: { query: 'x' } },
        mode: 'replay',
      }),
    ).rejects.toThrow(/replay mode requires a recorded fixture source/)
  })
})
