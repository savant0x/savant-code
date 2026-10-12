import fs from 'node:fs'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  catalogSearch,
  describeEndpoint,
  executeEndpoint,
  loadLaunchBundle,
  resetBundleCache,
} from '../runtime'

let bundleTemp: string | undefined

afterEach(() => {
  if (bundleTemp) fs.rmSync(bundleTemp, { recursive: true, force: true })
  bundleTemp = undefined
  resetBundleCache()
})

/** A private directory of real bundle copies for the cache-identity cases. */
function bundleCopies(count: number): string[] {
  bundleTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'connectors-bundles-'))
  const source = fileURLToPath(new URL('../catalog/catalog.json', import.meta.url))
  return Array.from({ length: count }, (_unused, index) => {
    const target = path.join(bundleTemp!, `catalog-${index}.json`)
    fs.copyFileSync(source, target)
    return target
  })
}

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
  /**
   * The tool-facing entry resolves credentials through the REAL env seam
   * (envParamsResolver at egress) — a replay never touches the network, but
   * the credential presence check is live. Supply a dummy value, then restore.
   */
  async function withTinyfishKey(body: () => Promise<void>): Promise<void> {
    const envKey = 'TINYFISH_CREDENTIALS_API_KEY'
    const originalKey = process.env[envKey]
    process.env[envKey] = 'test-key'
    try {
      await body()
    } finally {
      if (originalKey === undefined) delete process.env[envKey]
      else process.env[envKey] = originalKey
    }
  }

  test('tinyfish#search replay settles {credits:{}, evidence:{}} (FREE model)', async () => {
    const bundle = await loadLaunchBundle()
    await withTinyfishKey(() => runReplay(bundle))
  })

  async function runReplay(
    bundle: Awaited<ReturnType<typeof loadLaunchBundle>>,
    fetch?: (input: string) => Promise<Response>,
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
      fetch,
    })
    expect(result.httpStatus).toBe(200)
    expect(result.usage).toEqual({ credits: {}, evidence: {} })
    const output = result.output as Record<string, unknown>
    expect((output.results as unknown[]).length).toBe(2)
  }

  test('live mode uses the injected fetch and never touches global fetch', async () => {
    const bundle = await loadLaunchBundle()
    const raw = JSON.parse(
      await readFile(
        fixturePath(
          '../connectors/tinyfish/endpoints/search/fixtures/synthetic-happy.json',
        ),
        'utf8',
      ),
    ) as { calls: Array<{ res: { status: number; body: unknown } }> }
    const recorded = raw.calls[0]!
    const globalCalls: string[] = []
    const injected: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = Object.assign(
      (input: string | URL | Request) => {
        globalCalls.push(String(input))
        return Promise.reject(
          new Error('global fetch must never run for a live connector call'),
        )
      },
      { preconnect: () => {} },
    )
    const envKey = 'TINYFISH_CREDENTIALS_API_KEY'
    const originalKey = process.env[envKey]
    process.env[envKey] = 'test-key'
    try {
      const result = await executeEndpoint({
        bundle,
        provider: 'tinyfish',
        endpoint: 'tinyfish#search',
        input: { queryParams: { query: 'NVIDIA Q4 FY2025 revenue', domain_type: 'news' } },
        mode: 'live',
        fetch: async (input) => {
          injected.push(input)
          return new Response(JSON.stringify(recorded.res.body), {
            status: recorded.res.status,
            headers: { 'content-type': 'application/json' },
          })
        },
      })
      expect(result.httpStatus).toBe(recorded.res.status)
    } finally {
      globalThis.fetch = originalFetch
      if (originalKey === undefined) delete process.env[envKey]
      else process.env[envKey] = originalKey
    }
    expect(injected).toHaveLength(1)
    expect(injected[0]).toContain('api.search.tinyfish.ai')
    expect(globalCalls).toEqual([])
  })

  test('replay mode never runs a live fetch at all', async () => {
    const bundle = await loadLaunchBundle()
    const injected: string[] = []
    await withTinyfishKey(async () => {
      await runReplay(bundle, async (input) => {
        injected.push(input)
        throw new Error('injected live fetch must never run in replay')
      })
    })
    expect(injected).toEqual([])
  })

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

describe('bundle cache identity and failure ownership (FID-2026-1011-006)', () => {
  const catalogPath = () =>
    fileURLToPath(new URL('../catalog/catalog.json', import.meta.url))

  test('aliases of one artifact share a single in-flight load', async () => {
    const first = loadLaunchBundle()
    expect(loadLaunchBundle()).toBe(first)
    expect(loadLaunchBundle(catalogPath())).toBe(first)
    await first
    // Same artifact, same identity after fulfilment too.
    expect(loadLaunchBundle()).toBe(first)
  })

  test('a rejected load is evicted so a corrected artifact is re-read', async () => {
    const [target] = bundleCopies(1)
    fs.writeFileSync(target!, '{ not json')
    await expect(loadLaunchBundle(target!)).rejects.toThrow()
    fs.copyFileSync(catalogPath(), target!)
    const bundle = await loadLaunchBundle(target!)
    expect(Object.keys(bundle.providers).length).toBeGreaterThan(0)
  })

  test('a missing artifact is re-attempted once it exists', async () => {
    bundleCopies(0)
    const target = path.join(bundleTemp!, 'later.json')
    await expect(loadLaunchBundle(target)).rejects.toThrow()
    fs.copyFileSync(catalogPath(), target)
    expect((await loadLaunchBundle(target)).endpoints).toBeDefined()
  })

  test('fulfilled retention is capped at 16 artifacts, most recent kept', async () => {
    const paths = bundleCopies(17)
    const loads = paths.map((artifact) => loadLaunchBundle(artifact))
    await Promise.all(loads)
    expect(loadLaunchBundle(paths[0]!)).not.toBe(loads[0])
    expect(loadLaunchBundle(paths[16]!)).toBe(loads[16])
  })
})
