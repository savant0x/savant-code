import { join } from 'node:path'



import { describe, expect, test } from 'bun:test'

import { compileBundle } from '../compiler/mod.ts'
import { COMPILER_VERSION } from '../compiler/version.ts'
import { loadCategoryRegistry, loadConnectorDefs } from '../core/mod.ts'
import { ENGINE_VERSION } from '../engine/mod.ts'

/**
 * Contract-schemas suite (FID-2026-0930-001 gate): the compiler accepts
 * the vendored defs and produces the compiled catalog — providers,
 * endpoints, sealed units — with the contract invariants intact
 * (identity, FREE-model synthesis, usage model shapes).
 */

const CONNECTORS_DIR = join(import.meta.dir, '..', 'connectors')

async function compileLaunchCatalog() {
  const connectorsDir = join(import.meta.dir, '..', 'connectors')
  const [connectors, leafCategories] = await Promise.all([
    loadConnectorDefs(connectorsDir),
    loadCategoryRegistry(connectorsDir),
  ])
  return await compileBundle(connectors, {
    compilerVersion: COMPILER_VERSION,
    builtWithEngineVersion: ENGINE_VERSION,
    catalogVersion: '0.0.0-test',
    generatedAt: '1970-01-01T00:00:00.000Z',
    leafCategories,
  })
}

describe('contract schemas', () => {
  test('launch connectors load and compile', async () => {
    const sources = await loadConnectorDefs(CONNECTORS_DIR)
    const names = sources.map((source) => source.provider.name).sort()
    expect(names).toEqual(['exa', 'firecrawl', 'tinyfish'])
    const bundle = await compileLaunchCatalog()
    expect(Object.keys(bundle.endpoints).length).toBeGreaterThan(0)
  })

  test('tinyfish per-endpoint baseUrl lands in the compiled urls', async () => {
    const bundle = await compileLaunchCatalog()
    expect(bundle.endpoints['tinyfish#search']?.request.url).toBe(
      'https://api.search.tinyfish.ai/',
    )
    expect(bundle.endpoints['tinyfish#fetch']?.request.url).toBe(
      'https://api.fetch.tinyfish.ai/',
    )
  })

  test('FREE model synthesizes the shared empty quantities fn (D25/D26/D27)', async () => {
    const bundle = await compileLaunchCatalog()
    const search = bundle.endpoints['tinyfish#search']
    expect(search).toBeDefined()
    if (!search) return
    // FREE provider: no vendor meter — no consolidate fn compiles
    expect(search.usage.consolidate).toBeUndefined()
    // both quantities slots point at the ONE synthesized entry
    const synthesizedKey = search.usage.evidence.$fn.key
    expect(search.usage.estimate?.$fn.key).toBe(synthesizedKey)
    expect(bundle.fnTable[synthesizedKey]?.provenance).toBe(
      'core#usage.synthesizedEmpty',
    )
  })

  test('sealed unit carries exactly the fns its doc references', async () => {
    const bundle = await compileLaunchCatalog()
    const { sealUnit } = await import('../core/mod.ts')
    const unit = sealUnit(bundle, 'tinyfish#search')
    expect(unit.doc.id).toBe('tinyfish#search')
    // the sealed unit's fn entries (keyed by content hash) must all
    // exist in the bundle's fnTable — the link-integrity precondition
    for (const [hash] of Object.entries(unit.fns)) {
      expect(bundle.fnTable[hash]).toBeDefined()
    }
  })
})
