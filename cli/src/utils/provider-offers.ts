import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  parseCustatsFeed,
  feedFreshness,
} from '@savant-code/common/providers/custats-feed'
import { matchOfferHosts } from '@savant-code/common/providers/custats-models'
import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { hasProviderCredentials } from '@savant-code/common/providers/readiness'
import { z } from 'zod/v4'

import { getConfigDir } from './config-dir'
import { readStoredProviderKeys } from './provider-credentials'
import { providerNotifications } from './provider-notifications'
import { loadModelSelection, loadSettings } from './settings'
import { writeFileAtomic } from './write-file-atomic'

import type { ProviderFact } from '@savant-code/common/providers/provider-notifications'

const URL = 'https://freetokens.custats.info/feed'
const cacheSchema = z.object({
  version: z.literal(1),
  fetchedAt: z.number(),
  xml: z.string(),
})
let running: Promise<void> | undefined
const recentAttempts = new Map<string, number>()
const memoryCaches = new Map<string, z.infer<typeof cacheSchema>>()
export function refreshProviderOffers(signal?: AbortSignal): Promise<void> {
  if (running) return running
  running = refresh(signal).finally(() => {
    running = undefined
  })
  return running
}
async function refresh(signal?: AbortSignal): Promise<void> {
  const now = Date.now()
  const file = join(getConfigDir(), 'provider-offers.json')
  let cache = memoryCaches.get(file)
  try {
    if (existsSync(file))
      cache = cacheSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    /* Retain corrupt file; fresh fetch can be held without replacement. */
  }
  if (!cache || now - cache.fetchedAt >= 24 * 3600_000) {
    if (now - (recentAttempts.get(file) ?? 0) < 15 * 60_000) return
    recentAttempts.set(file, now)
    try {
      const r = await fetch(URL, {
        redirect: 'error',
        signal: AbortSignal.any([
          AbortSignal.timeout(5000),
          ...(signal ? [signal] : []),
        ]),
      })
      if (!r.ok) return
      const xml = await r.text()
      if (
        !feedFreshness(parseCustatsFeed(xml).lastBuildDate, now, 72 * 3600_000)
      )
        return
      cache = { version: 1, fetchedAt: now, xml }
      if (signal?.aborted) return
      memoryCaches.set(file, cache)
      persistOffers(file, cache)
    } catch {
      return
    }
  }
  if (
    signal?.aborted ||
    !cache ||
    cache.fetchedAt > now ||
    now - cache.fetchedAt > 24 * 3600_000
  )
    return
  const parsed = parseCustatsFeed(cache.xml)
  if (!feedFreshness(parsed.lastBuildDate, now, 72 * 3600_000)) return
  const registry = getEffectiveProviderRegistry()
  const configs = Object.values(registry)
  const hostToIds = new Map<string, string[]>()
  for (const c of configs) {
    try {
      const host = new globalThis.URL(c.baseUrl).hostname
      hostToIds.set(host, [...(hostToIds.get(host) ?? []), c.id])
    } catch {
      /* Endpoint placeholders need configured metadata. */
    }
  }
  const matches = matchOfferHosts(parsed.offers, new Set(hostToIds.keys()))
  const facts: ProviderFact[] = []
  const values = { ...readStoredProviderKeys(), ...process.env }
  const active = loadModelSelection()?.route.providerId
  const followed = loadSettings().monitoredProviders ?? []
  for (const { offer, hosts } of matches.attributed) {
    const ids = [...new Set(hosts.flatMap((h) => hostToIds.get(h) ?? []))]
    if (ids.length !== 1) continue
    const id = ids[0]
    const original = parsed.offers.find((o) => o.url === offer.url)
    const deadline = original?.expiryTimestamp
      ? Date.parse(original.expiryTimestamp)
      : NaN
    if (!Number.isFinite(deadline)) continue
    const left = deadline - now
    const window =
      left <= 0
        ? 'expired'
        : left <= 24 * 3600_000
          ? '24h'
          : left <= 72 * 3600_000
            ? '72h'
            : undefined
    if (!window) continue
    facts.push({
      key: `${offer.url}:${deadline}`,
      value: window,
      providerId: id,
      selected:
        id === active ||
        followed.includes(id) ||
        hasProviderCredentials(registry[id], values),
      kind: 'expiry',
      severity: 'warning',
      message: `${registry[id].label}: an advertised offer ${window === 'expired' ? 'expired' : `ends within ${window}`} (source: ${URL}). Account credits and eligibility are unverified.`,
    })
  }
  if (facts.length) providerNotifications.observe('offers', facts, now)
}
function persistOffers(file: string, cache: z.infer<typeof cacheSchema>): void {
  try {
    mkdirSync(getConfigDir(), { recursive: true })
    if (
      !existsSync(file) ||
      cacheSchema.safeParse(JSON.parse(readFileSync(file, 'utf8'))).success
    )
      writeFileAtomic(file, JSON.stringify(cache))
  } catch {
    /* Keep fresh memory and the diagnostic bytes of a corrupt file. */
  }
}
/** Unattributed offers remain visible as discovery; they never create setup actions. */
export function readProviderOfferDiscovery(now = Date.now()): string[] {
  const file = join(getConfigDir(), 'provider-offers.json')
  try {
    const cache =
      memoryCaches.get(file) ??
      cacheSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    const parsed = parseCustatsFeed(cache.xml)
    if (
      cache.fetchedAt > now ||
      now - cache.fetchedAt > 24 * 3600_000 ||
      !feedFreshness(parsed.lastBuildDate, now, 72 * 3600_000)
    )
      return []
    return parsed.offers.map(
      (offer) =>
        `${offer.title}: advertised offer; account eligibility unverified${offer.expiryTimestamp ? `; advertised deadline ${offer.expiryTimestamp}` : '; deadline unverified'}`,
    )
  } catch {
    return []
  }
}

/**
 * Test isolation: clears the in-flight promise, the per-file attempt clock
 * and the parsed-offer memory cache — process-lifetime state `bun test`
 * shares across files (FID-2026-1007-002). No I/O; the persisted cache file
 * is left alone.
 */
export function resetProviderOffersState(): void {
  running = undefined
  recentAttempts.clear()
  memoryCaches.clear()
}
