/**
 * FID-2026-0928-012 — free-options discovery (BYOK).
 *
 * Savant-Code has no provider backend: users wire their own keys. "Free"
 * therefore means free tiers/models of the gateways themselves, and the
 * wired/not-wired split comes from the user's own key store ∪ env vars —
 * the same truth `applyPersistedProviderApiKeys` consumes.
 *
 * Data source (operator ruling: live fetch + local cache): the keyless
 * custats free-models catalog — agent-facing by design (robots Policy A
 * allows retrieval; LIVE probe 2026-09-28: HTTP 200, OpenRouter schema,
 * `fetchedAt` field). Fetch happens on `/provider free` invocation only
 * (never at boot), at most once per 24h; any failure serves the last-good
 * cache with a staleness note and never hard-fails the command.
 *
 * The same refresh writes `~/.savant-code/free-options.md` — the
 * agent-answerable reference, so the user and the agent see one truth
 * (Law 13). Content is untrusted third-party text rendered as text; it
 * never mutates configuration.
 */
import fs from 'node:fs'
import path from 'node:path'

import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { freeOptionsPaths } from './free-options-paths'
import { renderFreeOptionsMarkdown } from './free-options-render'
import { readStoredProviderKeys } from './provider-credentials'

import type {
  FreeCatalogEnvelope,
  FreeCatalogModel,
  FreeLane,
  FreeOptionsContext,
  FreeOptionsReport,
  FreeProviderAttribution,
} from './free-options-types'

// Re-export the surface the command handler and tests consume, so callers
// keep ONE import module while the ceiling keeps the file split (Law 13).
export {
  renderCommandOutput,
  renderFreeOptionsMarkdown,
} from './free-options-render'
export { freeOptionsPaths } from './free-options-paths'
export type {
  FreeCatalogEnvelope,
  FreeCatalogModel,
  FreeLane,
  FreeOptionsContext,
  FreeOptionsReport,
  FreeProviderAttribution,
} from './free-options-types'

const CATALOG_URL = 'https://free-llm-models.custats.info/free_models.json'
const CACHE_MAX_AGE_MS = 24 * 3600_000
const FETCH_TIMEOUT_MS = 30_000
const USER_AGENT =
  'savant-code-free-options (+https://github.com/savant0x/savant-code)'

/** True when `fetchedAt` parses and is within the 24h TTL of `nowMs`. */
export function isCacheFresh(fetchedAt: string | null, nowMs: number): boolean {
  if (!fetchedAt) return false
  const ts = Date.parse(fetchedAt)
  if (Number.isNaN(ts)) return false
  const age = nowMs - ts
  return age >= 0 && age <= CACHE_MAX_AGE_MS
}

/** Keyless fetch of the catalog; null on ANY failure (soft-degrade). */
export async function fetchFreeCatalog(): Promise<FreeCatalogEnvelope | null> {
  try {
    const r = await fetch(CATALOG_URL, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!r.ok) return null
    return liftCatalog(await r.json())
  } catch {
    return null
  }
}

/** Defensive lift; null on structural mismatch (untrusted input). */
export function liftCatalog(raw: unknown): FreeCatalogEnvelope | null {
  if (typeof raw !== 'object' || raw === null) return null
  const j = raw as Record<string, unknown>
  const fetchedAt = typeof j['fetchedAt'] === 'string' ? j['fetchedAt'] : null
  if (!fetchedAt || !Array.isArray(j['models'])) return null
  const models: FreeCatalogModel[] = []
  for (const entry of j['models']) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    const id = typeof e['id'] === 'string' ? e['id'] : null
    const providerId =
      typeof e['providerId'] === 'string' ? e['providerId'] : null
    if (!id || !providerId) continue
    const contextLength =
      typeof e['context_length'] === 'number' ? e['context_length'] : null
    models.push({ id, providerId, context_length: contextLength })
  }
  const newModelIds = Array.isArray(j['newModelIds'])
    ? j['newModelIds'].filter((v): v is string => typeof v === 'string')
    : []
  const archivedModels: FreeCatalogEnvelope['archivedModels'] = []
  if (Array.isArray(j['archivedModels'])) {
    for (const entry of j['archivedModels']) {
      if (typeof entry !== 'object' || entry === null) continue
      const a = entry as Record<string, unknown>
      const id = typeof a['id'] === 'string' ? a['id'] : null
      const removedAt =
        typeof a['removedAt'] === 'string' ? a['removedAt'] : null
      if (id && removedAt) {
        archivedModels.push({
          id,
          providerId:
            typeof a['providerId'] === 'string' ? a['providerId'] : null,
          removedAt,
        })
      }
    }
  }
  return {
    fetchedAt,
    totalModels:
      typeof j['totalModels'] === 'number' ? j['totalModels'] : models.length,
    models,
    newModelIds,
    archivedModels,
  }
}

/**
 * Build the BYOK split. `catalog === null` means offline-with-no-cache: the
 * report still carries local lanes so the command never hard-fails.
 */
export function buildFreeOptionsReport(
  catalog: FreeCatalogEnvelope | null,
  context: FreeOptionsContext,
): FreeOptionsReport {
  const wiredFree: Array<FreeLane> = []
  const notWired: Array<FreeLane & { setupCommand: string }> = []

  if (catalog) {
    // Group models by providerId first, then partition by wired state.
    const byProvider = new Map<string, string[]>()
    for (const model of catalog.models) {
      const list = byProvider.get(model.providerId)
      if (list) list.push(model.id)
      else byProvider.set(model.providerId, [model.id])
    }
    for (const [providerId, models] of byProvider) {
      const attribution = context.registryByProviderId[providerId]
      if (!attribution) continue // unknown provider — not actionable here
      const lane = { providerId, label: attribution.label, models }
      if (context.wiredEnvVars.has(attribution.envVar)) {
        wiredFree.push(lane)
      } else {
        notWired.push({ ...lane, setupCommand: attribution.setupCommand })
      }
    }
    notWired.sort((a, b) => a.providerId.localeCompare(b.providerId))
  }

  return {
    fetchedAt: catalog?.fetchedAt ?? null,
    stale: catalog !== null && !isCacheFresh(catalog.fetchedAt, context.nowMs),
    wiredFree,
    notWired,
    localFree: context.localProviders.map((p) => ({ ...p })),
  }
}

/**
 * Assemble the machine context (wired env vars ∪ persisted store) and run
 * one refresh cycle: fetch-if-stale, persist cache + markdown, return the
 * report. Used by the `/provider free` handler.
 */
export async function refreshFreeOptions(): Promise<FreeOptionsReport> {
  const paths = freeOptionsPaths()
  const nowMs = Date.now()

  let catalog = await fetchFreeCatalog()
  let fetchedAt: string | null = catalog?.fetchedAt ?? null

  if (catalog === null) {
    // Offline / failed: serve the cache if one exists.
    try {
      if (fs.existsSync(paths.cache)) {
        catalog = liftCatalog(JSON.parse(fs.readFileSync(paths.cache, 'utf8')))
      }
    } catch {
      catalog = null
    }
    if (catalog) fetchedAt = catalog.fetchedAt
  }

  const context: FreeOptionsContext = {
    nowMs,
    wiredEnvVars: collectWiredEnvVars(),
    registryByProviderId: buildRegistryAttribution(),
    localProviders: collectLocalProviders(),
  }
  const report = buildFreeOptionsReport(catalog, context)
  report.fetchedAt = fetchedAt

  if (catalog !== null) {
    try {
      fs.mkdirSync(path.dirname(paths.cache), { recursive: true })
      fs.writeFileSync(paths.cache, JSON.stringify(catalog, null, 2))
      fs.writeFileSync(paths.markdown, renderFreeOptionsMarkdown(report))
    } catch {
      // Persistence is best-effort; the command output already carries the
      // information.
    }
  }
  return report
}

/** Env vars with non-empty values (persisted store ∪ environment). */
function collectWiredEnvVars(): Set<string> {
  const wired = new Set<string>()
  try {
    for (const envVar of Object.keys(readStoredProviderKeys())) {
      wired.add(envVar)
    }
  } catch {
    // No credentials file yet — env vars still count.
  }
  for (const config of Object.values(PROVIDER_REGISTRY)) {
    // Local providers carry `credentials: {}` — no env var, nothing to check.
    const envVar: string | undefined =
      'envVar' in config.credentials ? config.credentials.envVar : undefined
    if (envVar && process.env[envVar]?.trim()) wired.add(envVar)
  }
  return wired
}

/** Catalog providerId → registry attribution, for known providers. */
function buildRegistryAttribution(): Record<string, FreeProviderAttribution> {
  const map: Record<string, FreeProviderAttribution> = {}
  for (const config of Object.values(PROVIDER_REGISTRY)) {
    if (config.kind === 'local') continue
    const envVar: string | undefined =
      'envVar' in config.credentials ? config.credentials.envVar : undefined
    if (!envVar) continue
    map[config.id] = {
      id: config.id,
      label: config.label,
      envVar,
      setupCommand: `/provider ${config.id}`,
    }
  }
  return map
}

/** Registry local providers (no key at all). */
function collectLocalProviders(): Array<{
  id: string
  label: string
  setupCommand: string
}> {
  const out: Array<{ id: string; label: string; setupCommand: string }> = []
  for (const config of Object.values(PROVIDER_REGISTRY)) {
    if (config.kind !== 'local') continue
    out.push({
      id: config.id,
      label: config.label,
      setupCommand: `/provider ${config.id}`,
    })
  }
  return out
}
