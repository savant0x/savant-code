import { join } from 'node:path'



import { describe, expect, test } from 'bun:test'

import { compileBundle } from '../compiler/mod.ts'
import { COMPILER_VERSION } from '../compiler/version.ts'
import {
  loadCategoryRegistry,
  loadConnectorDefs,
  stableStringify,
} from '../core/mod.ts'
import { ENGINE_VERSION } from '../engine/mod.ts'

/**
 * Compiler-determinism suite (FID-2026-0930-001 gate): compiling the same
 * defs twice with frozen metadata produces byte-identical bundles — the
 * upstream invariant that makes the catalog a pure function of repo
 * content (upstream double-compile rule; RFC 8785 canonical hashing).
 */

async function compile() {
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

describe('compiler determinism', () => {
  test('double compile is byte-identical (frozen metadata)', async () => {
    const first = await compile()
    const second = await compile()
    expect(stableStringify(second)).toBe(stableStringify(first))
  })

  test('compile is non-trivial (guards a vacuous pass)', async () => {
    const bundle = await compile()
    expect(Object.keys(bundle.endpoints).length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(bundle.providers).sort()).toEqual([
      'exa',
      'firecrawl',
      'tinyfish',
    ])
  })
})
