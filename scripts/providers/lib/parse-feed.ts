/**
 * FID-2026-0914-003 — feed parsing (Stage A, step 1).
 *
 * Normalizes freeairouter `data/sites.json` records into a stable internal
 * card shape. The feed is untrusted input: malformed entries are skipped,
 * optional fields lift to safe defaults, and raw values pass through
 * unchanged (the rendered-site label "Up" is actually `verified` in the
 * data — audit finding A1; never hardcode rendered labels).
 */

export type FeedCard = {
  id: number | null
  host: string
  url: string
  category: string | null
  categoryConfirmed: boolean
  status: string
  kind: string | null
  platform: string | null
  freeQuotaEn: string
  freeModelsEn: string[]
  probe: {
    reachable: boolean
    latencyMs: number | null
    modelsCount: number
    modelsPublic: boolean
    signupOpen: boolean | null
    quotaHint: string | null
  } | null
  firstSeenAt: string | null
  lastProbedAt: string | null
  discoveredFrom: string | null
}

/** Parse the raw `{card}` record array; malformed entries are skipped. */
export function parseFeedSites(raw: unknown): FeedCard[] {
  if (!Array.isArray(raw)) return []
  const cards: FeedCard[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const card = (entry as { card?: unknown }).card
    if (typeof card !== 'object' || card === null) continue
    const c = card as Record<string, unknown>
    const host = typeof c['host'] === 'string' ? c['host'] : null
    if (!host) continue

    const probe =
      typeof c['probe'] === 'object' && c['probe'] !== null
        ? (() => {
            const p = c['probe'] as Record<string, unknown>
            return {
              reachable: p['reachable'] === true,
              latencyMs:
                typeof p['latencyMs'] === 'number' ? p['latencyMs'] : null,
              modelsCount:
                typeof p['modelsCount'] === 'number' ? p['modelsCount'] : 0,
              modelsPublic: p['modelsPublic'] === true,
              signupOpen:
                typeof p['signupOpen'] === 'boolean'
                  ? (p['signupOpen'] as boolean)
                  : null,
              quotaHint:
                typeof p['quotaHint'] === 'string' ? p['quotaHint'] : null,
            }
          })()
        : null

    cards.push({
      id: typeof c['id'] === 'number' ? c['id'] : null,
      host,
      url: typeof c['url'] === 'string' ? c['url'] : `https://${host}`,
      category:
        typeof c['category'] === 'string' ? (c['category'] as string) : null,
      categoryConfirmed: c['categoryConfirmed'] === true,
      status: typeof c['status'] === 'string' ? c['status'] : 'down',
      kind: typeof c['kind'] === 'string' ? (c['kind'] as string) : null,
      platform:
        typeof c['platform'] === 'string' ? (c['platform'] as string) : null,
      freeQuotaEn:
        typeof c['freeQuota_en'] === 'string' ? c['freeQuota_en'] : '',
      freeModelsEn: Array.isArray(c['freeModels_en'])
        ? (c['freeModels_en'] as unknown[]).filter(
            (m): m is string => typeof m === 'string',
          )
        : [],
      probe,
      firstSeenAt:
        typeof c['firstSeenAt'] === 'string' ? c['firstSeenAt'] : null,
      lastProbedAt:
        typeof c['lastProbedAt'] === 'string' ? c['lastProbedAt'] : null,
      discoveredFrom:
        typeof c['discoveredFrom'] === 'string' ? c['discoveredFrom'] : null,
    })
  }
  return cards
}
