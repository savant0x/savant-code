/**
 * FID-2026-0928-011 — the custats offers/models harvest (second discovery
 * source). Orchestration only; all parsing/matching lives in lib/custats.ts.
 *
 * Fetches two keyless feeds (transparent UA, hard timeouts, single pass —
 * same etiquette contract as the freeairouter leg):
 *   1. freetokens.custats.info/feed          → offers ledger (time events)
 *   2. free-llm-models.custats.info/…json    → enrichment + retirement signal
 *
 * Offers NEVER enter the host candidate queue; attribution is review-only.
 * Freshness gates are soft: a stale source skips the cycle with a log line
 * and keeps last-good state (a stale operator feed must not break scripting).
 * Writes land under dev/ only (assertWithinDev). Offers are untrusted data;
 * nothing here mutates provider config — the gauntlet decides promotion.
 *
 * Run: bun run providers:custats   (or: bun scripts/providers/harvest-custats.ts)
 */
import { readFileSync, existsSync } from 'node:fs'

import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { readPriorState } from './lib/candidates-io'
import { parseCustatsFeed, feedFreshness } from './lib/custats-feed'
import { matchOfferHosts, parseCustatsModels } from './lib/custats-models'
import { renderCustatsReport } from './lib/custats-report'
import { assertWithinDev } from './lib/typosquat'

const OFFERS_FEED_URL = 'https://freetokens.custats.info/feed'
const MODELS_FEED_URL = 'https://free-llm-models.custats.info/free_models.json'

const FEED_MAX_AGE_MS = 72 * 3600_000 // offers RSS lastBuildDate ≤ 72h
const CATALOG_MAX_AGE_MS = 48 * 3600_000 // models fetchedAt ≤ 48h

const LEDGER_RELATIVE_PATH = 'dev/provider-candidates/custats.json'
const REPORT_RELATIVE_PATH = 'dev/provider-candidates/custats-report.md'

const USER_AGENT =
  'savant-code-provider-discovery (+https://github.com/savant0x/savant-code)'

type OfferLedgerEntry = {
  title: string
  url: string
  category: string | null
  expiryKind: 'ongoing' | 'expires'
  expiryDate: string | null
  amountHint: string | null
  /** Hosts matched from known infrastructure; review-only. */
  hosts: string[]
  firstSeenUtc: string
  lastSeenUtc: string
}

type CustatsLedger = {
  _meta: {
    version: 1
    pipeline: 'FID-2026-0928-011'
    lastOffersFetchUtc: string | null
    lastModelsFetchUtc: string | null
    lastOffersBuildDate: string | null
  }
  offers: Record<string, OfferLedgerEntry> // keyed by offer detail URL
  lastModels: {
    fetchedAt: string
    totalModels: number | null
    newModelIds: string[]
    archived: Array<{
      id: string
      providerId: string | null
      removedAt: string
    }>
  } | null
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    })
    if (!r.ok) {
      console.error(`[custats] ${url} → HTTP ${r.status} (skipping cycle)`)
      return null
    }
    return await r.text()
  } catch (error) {
    console.error(
      `[custats] ${url} → ${error instanceof Error ? error.message : String(error)} (skipping cycle)`,
    )
    return null
  }
}

function readLedger(stateDir: string): CustatsLedger {
  const path = `${stateDir}/custats.json`
  try {
    if (!existsSync(path)) return emptyLedger()
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return emptyLedger()
    const candidate = parsed as Partial<CustatsLedger>
    if (
      typeof candidate._meta !== 'object' ||
      candidate._meta === null ||
      typeof candidate.offers !== 'object' ||
      candidate.offers === null
    ) {
      return emptyLedger()
    }
    return candidate as CustatsLedger
  } catch {
    // Corrupt ledger is not worth failing a run over — start fresh.
    return emptyLedger()
  }
}

function emptyLedger(): CustatsLedger {
  return {
    _meta: {
      version: 1,
      pipeline: 'FID-2026-0928-011',
      lastOffersFetchUtc: null,
      lastModelsFetchUtc: null,
      lastOffersBuildDate: null,
    },
    offers: {},
    lastModels: null,
  }
}

function daysUntil(dateStr: string, nowMs: number): number | null {
  const ts = Date.parse(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(ts)) return null
  return Math.ceil((ts - nowMs) / 86_400_000)
}

async function main(): Promise<number> {
  assertWithinDev(LEDGER_RELATIVE_PATH)
  assertWithinDev(REPORT_RELATIVE_PATH)

  const stateDir = 'dev/provider-candidates'
  const nowMs = Date.now()
  const nowUtc = new Date(nowMs).toISOString()

  // Known hosts = candidates ledger ∪ seed hosts ∪ registry baseUrls — the
  // same attribution surface the freeairouter leg tracks.
  const prior = readPriorState(stateDir)
  const knownHosts = new Set<string>(prior.keys())
  for (const entry of providerBaseUrls()) knownHosts.add(entry)

  const offersXml = await fetchText(OFFERS_FEED_URL)
  const modelsRawText = await fetchText(MODELS_FEED_URL)

  // ---- offers leg ----
  let offersFetchSkipped = true
  let parsed: ReturnType<typeof parseCustatsFeed> | null = null
  if (offersXml !== null) {
    parsed = parseCustatsFeed(offersXml)
    if (feedFreshness(parsed.lastBuildDate, nowMs, FEED_MAX_AGE_MS)) {
      offersFetchSkipped = false
    } else {
      console.error(
        `[custats] offers feed stale (lastBuildDate=${parsed.lastBuildDate}) — skipping cycle, keeping last-good state`,
      )
    }
  }

  // ---- models leg ----
  let models: ReturnType<typeof parseCustatsModels> = null
  let modelsFetchSkipped = true
  if (modelsRawText !== null) {
    try {
      models = parseCustatsModels(JSON.parse(modelsRawText))
    } catch {
      models = null
    }
    if (models && feedFreshness(models.fetchedAt, nowMs, CATALOG_MAX_AGE_MS)) {
      modelsFetchSkipped = false
    } else {
      console.error(
        '[custats] models catalog stale/unparseable — skipping cycle, keeping last-good state',
      )
    }
  }

  if (offersFetchSkipped && modelsFetchSkipped) {
    console.error('[custats] both legs skipped — nothing to do')
    return 0 // soft exit; automation keeps working
  }

  // ---- attribution + ledger merge ----
  const ledger = readLedger(stateDir)
  const apiProviderOffers = (parsed?.offers ?? []).filter(
    (o) => o.category !== null && /api provider/i.test(o.category),
  )
  const { attributed, unattributed } = matchOfferHosts(
    apiProviderOffers,
    knownHosts,
  )

  for (const entry of attributed) {
    const existing = ledger.offers[entry.offer.url]
    if (existing) {
      existing.lastSeenUtc = nowUtc
      existing.hosts = entry.hosts
    } else {
      ledger.offers[entry.offer.url] = {
        title: entry.offer.title,
        url: entry.offer.url,
        category: entry.offer.category,
        expiryKind: entry.offer.expiryKind,
        expiryDate: entry.offer.expiryDate,
        amountHint: entry.offer.amountHint,
        hosts: entry.hosts,
        firstSeenUtc: nowUtc,
        lastSeenUtc: nowUtc,
      }
    }
  }
  if (!offersFetchSkipped && parsed) {
    ledger._meta.lastOffersFetchUtc = nowUtc
    ledger._meta.lastOffersBuildDate = parsed.lastBuildDate
  }

  if (models && !modelsFetchSkipped) {
    ledger.lastModels = {
      fetchedAt: models.fetchedAt,
      totalModels: models.totalModels,
      newModelIds: models.newModelIds,
      archived: models.archived,
    }
    ledger._meta.lastModelsFetchUtc = nowUtc
  }

  // ---- persist + report ----
  const ledgerPath = LEDGER_RELATIVE_PATH
  await Bun.write(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)

  const expiringSoon = attributed
    .filter((a) => a.offer.expiryKind === 'expires' && a.offer.expiryDate)
    .map((a) => ({
      title: a.offer.title,
      url: a.offer.url,
      expiryDate: a.offer.expiryDate ?? '',
      daysLeft: daysUntil(a.offer.expiryDate ?? '', nowMs),
    }))
    .filter((o) => o.expiryDate !== '')
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))

  const report = renderCustatsReport({
    nowUtc,
    offersFetchSkipped,
    modelsFetchSkipped,
    attributed,
    unattributed,
    expiringSoon,
    models,
    modelsSourceFresh: !modelsFetchSkipped,
  })
  await Bun.write(REPORT_RELATIVE_PATH, report)

  console.log(
    `[custats] offers: ${attributed.length} attributed / ${unattributed.length} unattributed / ${expiringSoon.length} expiring soon · models: ${models ? `${models.totalModels ?? models.models.length} rows, ${models.newModelIds.length} new, ${models.archived.length} archived` : 'skipped'}`,
  )
  console.log(`[custats] ledger → ${ledgerPath}`)
  console.log(`[custats] report → ${REPORT_RELATIVE_PATH}`)
  return 0
}

/** Registry baseUrls folded into the known-host set for attribution. */
function providerBaseUrls(): string[] {
  const hosts: string[] = []
  for (const config of Object.values(PROVIDER_REGISTRY)) {
    const host = config.baseUrl.match(/^https?:\/\/([^/]+)/)?.[1]
    if (host) hosts.push(host.toLowerCase())
  }
  return hosts
}

process.exitCode = await main()
