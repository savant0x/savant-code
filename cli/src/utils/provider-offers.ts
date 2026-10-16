import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  parseCustatsFeed,
  feedFreshness,
  type CustatsOffer,
} from '@savant-code/common/providers/custats-feed'
import {
  matchOfferHosts,
  type MatchableOffer,
} from '@savant-code/common/providers/custats-models'
import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { hasProviderCredentials } from '@savant-code/common/providers/readiness'
import { z } from 'zod/v4'

import { getConfigDir } from './config-dir'
import { readStoredProviderKeys } from './provider-credentials'
import { providerNotifications } from './provider-notifications'
import { loadModelSelection, loadSettings } from './settings'
import { writeFileAtomic } from './write-file-atomic'

import type { FreeOfferRow } from './free-options-types'
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

/**
 * The advertised deadline the feed states for one offer, in epoch ms, or null
 * when it states none we can resolve (FID-2026-1016-010).
 *
 * The feed lifts two shapes and the CLI was keyed to the wrong one: every
 * consumer read `expiryTimestamp` (the vestigial ISO branch) while the live
 * feed emits a human date into `expiryDate`, so the whole deadline surface was
 * structurally inert. ISO wins when present; otherwise a date-only deadline
 * resolves to END OF DAY UTC, so an offer is never called expired early.
 */
export function resolveOfferDeadlineMs(offer: CustatsOffer): number | null {
  if (offer.expiryTimestamp) {
    const iso = Date.parse(offer.expiryTimestamp)
    if (Number.isFinite(iso)) return iso
  }
  if (offer.expiryKind === 'expires' && offer.expiryDate) {
    const day = Date.parse(`${offer.expiryDate}T23:59:59Z`)
    if (Number.isFinite(day)) return day
  }
  return null
}

/** The deadline day, UTC. */
function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * What the display may say about one offer's deadline (FID-2026-1016-010).
 *
 * Three honest cases, never conflated: a resolved deadline is advertised; a
 * parsed `· ongoing.` tail is the feed stating there is none; a tail that
 * annexes an expiry we cannot read, or no tail at all, is data we hold and
 * cannot resolve — which stays `unverified`. The signal is the TAIL's
 * statement, deliberately not the description's prose: an offer whose terms
 * say `credits expire 12 months after grant` (or `never expire`) while its
 * tail says `ongoing` advertises no deadline, and calling that unverified
 * would be the same dishonesty in the other direction.
 */
function offerDeadlineLabel(offer: CustatsOffer): string {
  const deadline = resolveOfferDeadlineMs(offer)
  if (deadline !== null) return `advertised deadline ${isoDay(deadline)}`
  if (offer.category === null || offer.expiryKind === 'expires')
    return 'deadline unverified'
  return 'no advertised deadline'
}

/**
 * The cached feed's on-disk path — ONE home for it, so the refresh writer and
 * the reader below cannot drift apart on the file name (a caller that guesses
 * it silently reads an empty feed).
 */
export function providerOffersCachePath(): string {
  return join(getConfigDir(), 'provider-offers.json')
}

/**
 * The registry's host→provider-id map plus the registry it came from — ONE
 * walk, shared by the expiry-fact loop and the discovery rows (Law 13), so
 * attribution cannot drift between what we notify and what we display.
 */
function providerHostAttribution(): {
  registry: ReturnType<typeof getEffectiveProviderRegistry>
  hostToIds: Map<string, string[]>
} {
  const registry = getEffectiveProviderRegistry()
  const hostToIds = new Map<string, string[]>()
  for (const c of Object.values(registry)) {
    try {
      const host = new globalThis.URL(c.baseUrl).hostname
      hostToIds.set(host, [...(hostToIds.get(host) ?? []), c.id])
    } catch {
      /* Endpoint placeholders need configured metadata. */
    }
  }
  return { registry, hostToIds }
}

export function refreshProviderOffers(signal?: AbortSignal): Promise<void> {
  if (running) return running
  running = refresh(signal).finally(() => {
    running = undefined
  })
  return running
}
async function refresh(signal?: AbortSignal): Promise<void> {
  const now = Date.now()
  const file = providerOffersCachePath()
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
  const { hostToIds } = providerHostAttribution()
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
    const deadline = original ? resolveOfferDeadlineMs(original) : null
    if (deadline === null) continue
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
/** Fresh feed offers, or [] when the cache is missing, stale, or unreadable. */
function readFreshFeedOffers(now: number): CustatsOffer[] {
  const file = providerOffersCachePath()
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
    return parsed.offers
  } catch {
    return []
  }
}

/**
 * Fresh offers as display rows: what the feed advertises, whose lanes the
 * prose names, and the detail page (FID-2026-1016-010). Unattributed offers
 * remain visible as discovery with an empty `providerLabels`; they never
 * create setup actions (FID-2026-0928-012).
 */
export function readProviderOfferDiscovery(now = Date.now()): FreeOfferRow[] {
  const offers = readFreshFeedOffers(now)
  if (offers.length === 0) return []
  const { registry, hostToIds } = providerHostAttribution()
  const labels = new Map<MatchableOffer, string[]>()
  for (const { offer, hosts } of matchOfferHosts(
    offers,
    new Set(hostToIds.keys()),
  ).attributed) {
    const ids = [...new Set(hosts.flatMap((h) => hostToIds.get(h) ?? []))]
    labels.set(
      offer,
      ids
        .map((id) => registry[id]?.label ?? id)
        .sort((a, b) => a.localeCompare(b)),
    )
  }
  return offers.map((offer) => ({
    title: offer.title,
    category: offer.category,
    deadlineLabel: offerDeadlineLabel(offer),
    providerLabels: labels.get(offer) ?? [],
    url: offer.url,
  }))
}

/**
 * Offers whose advertised deadline falls within the next 72 hours of `now`
 * (FID-2026-1008-004). Offers without a RESOLVABLE deadline are never counted
 * — the resolver reads both feed shapes, so a date-only `expires <Mon> <d>,
 * <yyyy>` deadline counts too (FID-2026-1016-010).
 */
export function countOffersEndingSoon(now = Date.now()): number {
  return readFreshFeedOffers(now).filter((offer) => {
    const deadline = resolveOfferDeadlineMs(offer)
    if (deadline === null) return false
    const left = deadline - now
    return left > 0 && left <= 72 * 3600_000
  }).length
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
