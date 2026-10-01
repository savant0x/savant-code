/**
 * build-catalog (FID-2026-0930-003 step 2): compile the launch catalog ONCE
 * at package build time and check the artifact in at src/catalog/catalog.json.
 *
 * Runtime consumers (the agent-runtime connector handlers) load the
 * checked-in bundle — NEVER the compiler: compiler/normalize.ts and
 * compiler/lint.ts import the `typescript` package, and a tool host must
 * not pull a transpiler into its dependency graph. Re-run this script
 * whenever connector sources change (`bun run build:catalog` from the
 * package root); the bundle test asserts it is fresh.
 *
 * Determinism: compileBundle is byte-deterministic for the same sources
 * (upstream invariant, compiler-determinism.test.ts) — the committed
 * artifact is reproducible from the tree.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'


import { compileBundle } from '../src/compiler/mod.ts'
import { COMPILER_VERSION } from '../src/compiler/version.ts'
import {
  loadCategoryRegistry,
  loadConnectorDefs,
} from '../src/core/mod.ts'
import { ENGINE_VERSION } from '../src/engine/mod.ts'

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const connectorsDir = `${PACKAGE_ROOT}src/connectors`
const outPath = `${PACKAGE_ROOT}src/catalog/catalog.json`

const [connectors, leafCategories] = await Promise.all([
  loadConnectorDefs(connectorsDir),
  loadCategoryRegistry(connectorsDir),
])

// A–Z v0.0.35 audit finding: the catalog version mirrors the product version
// but was a hand-maintained literal the bump script cannot reach — it went
// stale at the 0.0.35 bump. Read it from the root manifest so the artifact
// always carries the tree's version.
const rootManifest = JSON.parse(
  await readFile(`${REPO_ROOT}package.json`, 'utf8'),
) as { version: string }
// (The connectors package manifest version itself is owned by the bump
// script's synchronized list — it joined during the 0.0.35 audit.)

const bundle = await compileBundle(connectors, {
  compilerVersion: COMPILER_VERSION,
  builtWithEngineVersion: ENGINE_VERSION,
  catalogVersion: rootManifest.version,
  generatedAt: new Date().toISOString(),
  leafCategories,
})

await mkdir(`${REPO_ROOT}src/catalog`, { recursive: true })
await writeFile(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')

const endpointCount = Object.keys(bundle.endpoints).length
const providerCount = Object.keys(bundle.providers).length
console.log(
  `catalog: wrote ${outPath} (${providerCount} providers, ` +
    `${endpointCount} endpoints, ` +
    `minEngineVersion ${bundle.minEngineVersion})`,
)
