/**
 * Tool-facing runtime entry (FID-2026-0930-003): the catalog + engine
 * surface a TOOL HOST consumes — and deliberately nothing else.
 *
 * THE COMPILER STAYS OUT: `@shared/compiler` (and therefore the
 * `typescript` package) is never imported here, so a runtime serving the
 * connector tools does not pull a transpiler into its dependency graph.
 * Consumers load the CHECKED-IN COMPILED BUNDLE via `loadLaunchBundle()`
 * (or inject their own path/loader) and execute sealed units through
 * `Engine` + `sealUnit`.
 *
 * Credentials resolve through the engine's env seam only
 * (`envParamsResolver`); values never surface through this module.
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  type Bundle,
  type EndpointDoc,
  type Json,
  type JsonSchemaDoc,
  listEndpoints,
  listProviders,
  sealUnit,
  type RunCompleted,
  type RunInput,
  zBundle,
} from './core/mod.ts'
import {
  credentialEnvVarsFor,
  credentialFieldsOf,
  directTransport,
  Engine,
  envParamsResolver,
  resolveCredentialEnv,
} from './engine/mod.ts'
import { makeReplayFetch, type RuntimeRecordedCall } from './runtime-replay.ts'

/** Default artifact path — the checked-in compiled bundle next to src/. */
function defaultBundlePath(): string {
  return fileURLToPath(new URL('./catalog/catalog.json', import.meta.url))
}

/** Parse + validate a bundle file (fail closed — never trust raw JSON). */
export async function loadBundleFile(path: string): Promise<Bundle> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as Json
  const parsed = zBundle.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`bundle at ${path} failed validation`)
  }
  return parsed.data
}

const cachedBundles = new Map<string, Promise<Bundle>>()
const fulfilledBundles = new Set<string>()
const MAX_CACHED_BUNDLES = 16

/** The launch catalog bundle, loaded once per process. */
export function loadLaunchBundle(
  path: string = defaultBundlePath(),
): Promise<Bundle> {
  const key = resolve(path)
  const cached = cachedBundles.get(key)
  if (cached) {
    cachedBundles.delete(key)
    cachedBundles.set(key, cached)
    return cached
  }
  const pending = loadBundleFile(key)
  cachedBundles.set(key, pending)
  void pending.then(
    () => {
      if (cachedBundles.get(key) !== pending) return
      fulfilledBundles.add(key)
      for (const candidate of cachedBundles.keys()) {
        if (fulfilledBundles.size <= MAX_CACHED_BUNDLES) break
        if (!fulfilledBundles.delete(candidate)) continue
        cachedBundles.delete(candidate)
      }
    },
    () => {
      if (cachedBundles.get(key) === pending) {
        cachedBundles.delete(key)
        fulfilledBundles.delete(key)
      }
    },
  )
  return pending
}

/** Test hook — forget the cached bundle (a re-load picks up new bytes). */
export function resetBundleCache(): void {
  cachedBundles.clear()
  fulfilledBundles.clear()
}

export interface CatalogSearchFilter {
  provider?: string
  category?: string
  query?: string
}

/** Exact result unions — JSONValue-assignable (type aliases, no interfaces). */
export type CatalogProviderSummary = {
  name: string
  displayName: string
  summary: string
  endpointCount: number
}
export type CatalogEndpointSummary = {
  id: string
  displayName: string
  summary: string
  categories: string[]
}
export type CatalogSearchResult =
  | { providers: CatalogProviderSummary[] }
  | { endpoints: CatalogEndpointSummary[] }

/**
 * Catalog browse for `connector_search`: no filters → providers; any
 * filter → matching endpoints. `query` is a free-text filter over
 * id/displayName/summary (case-insensitive substring).
 */
export function catalogSearch(
  bundle: Bundle,
  filter: CatalogSearchFilter = {},
): CatalogSearchResult {
  const hasEndpointFilter =
    filter.provider !== undefined ||
    filter.category !== undefined ||
    filter.query !== undefined
  if (!hasEndpointFilter) {
    return {
      providers: listProviders(bundle).map((p) => ({
        name: p.name,
        displayName: p.displayName,
        summary: p.summary,
        endpointCount: p.endpointCount,
      })),
    }
  }
  const query = filter.query?.toLowerCase()
  return {
    endpoints: listEndpoints(bundle, {
      provider: filter.provider,
      category: filter.category,
    }).filter(
      (e) =>
        query === undefined ||
        e.id.toLowerCase().includes(query) ||
        e.displayName.toLowerCase().includes(query) ||
        e.summary.toLowerCase().includes(query),
    ),
  }
}

/**
 * `connector_describe`: the doc IS the contract — returned as-is after
 * identity checks. `provider` must match the doc's own provider so a
 * typo'd pairing fails with the id list instead of executing under the
 * wrong vendor identity.
 */
export function describeEndpoint(
  bundle: Bundle,
  provider: string,
  endpointId: string,
): EndpointDoc {
  const doc = bundle.endpoints[endpointId]
  if (!doc) {
    throw new Error(
      `endpoint not in bundle: ${endpointId} (known: ` +
        `${Object.keys(bundle.endpoints).sort().join(', ')})`,
    )
  }
  if (doc.provider !== provider) {
    throw new Error(
      `endpoint ${endpointId} belongs to provider "${doc.provider}", ` +
        `not "${provider}"`,
    )
  }
  return doc
}

export type CredentialFieldReport = {
  field: string
  envVar: string
  aliasEnvVar?: string
  present: boolean
}

/**
 * `connector_credentials`: NAMES + presence only. Values are read (by the
 * engine's resolver, at egress) but never returned here.
 */
export function providerCredentials(
  provider: string,
  credentials: JsonSchemaDoc,
): { credentials: CredentialFieldReport[]; ready: boolean } {
  const fields = credentialFieldsOf(credentials)
  const reports = fields.map((field) => {
    const [canonical, alias] = credentialEnvVarsFor(provider, field)
    const value = resolveCredentialEnv(provider, field)
    return {
      field,
      envVar: canonical,
      ...(alias !== undefined ? { aliasEnvVar: alias } : {}),
      present: value !== undefined && value !== '',
    }
  })
  return { credentials: reports, ready: reports.every((r) => r.present) }
}

/** The replay transport input: recorded {req,res} chains. */
export interface RecordedFixtureSource {
  kind: 'fixture'
  /** `replayFetch`-compatible loader — the host supplies it. */
  load: (path: string) => Promise<unknown>
  path: string
}

export function isRecordedFixtureSource(
  v: unknown,
): v is RecordedFixtureSource {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { kind?: unknown }).kind === 'fixture' &&
    typeof (v as { load?: unknown }).load === 'function' &&
    typeof (v as { path?: unknown }).path === 'string'
  )
}

export interface ExecuteEndpointOptions {
  bundle: Bundle
  provider: string
  endpoint: string
  input: RunInput
  mode?: 'live' | 'replay'
  /** replay mode: the recorded fixture chain to serve. */
  fixture?: unknown
  /** live-mode fetch override (tests); default = global fetch. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
}

/**
 * `connector_invoke`: validate → seal → engine load → sync run.
 * Live mode egresses through `directTransport` with the env credential
 * seam; replay mode serves the host-supplied fixture chain (zero
 * network) and requires `fixture`.
 */
export async function executeEndpoint(
  opts: ExecuteEndpointOptions,
): Promise<RunCompleted> {
  const mode = opts.mode ?? 'live'
  const doc = describeEndpoint(opts.bundle, opts.provider, opts.endpoint)
  let fetchFn: ExecuteEndpointOptions['fetch'] = opts.fetch
  if (mode === 'replay') {
    if (!isRecordedFixtureSource(opts.fixture)) {
      throw new Error(
        `connector_invoke replay mode requires a recorded fixture source ` +
          `(kind: "fixture") for ${doc.id}`,
      )
    }
    const fixture = (await opts.fixture.load(opts.fixture.path)) as {
      calls: RuntimeRecordedCall[]
    }
    if (!Array.isArray(fixture?.calls) || fixture.calls.length === 0) {
      throw new Error(`fixture at ${opts.fixture.path} has no recorded calls`)
    }
    fetchFn = makeReplayFetch(opts.fixture.path, fixture, doc.request.url)
  }
  const engine = new Engine({
    transport: directTransport({
      params: envParamsResolver,
      ...(fetchFn !== undefined ? { fetch: fetchFn } : {}),
    }),
  })
  const loaded = await engine.load(sealUnit(opts.bundle, doc.id))
  return await loaded.run(opts.input)
}
