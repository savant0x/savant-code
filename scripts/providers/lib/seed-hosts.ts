/**
 * FID-2026-0915-003 — operator seed intake.
 *
 * The operator's free-provider expansion list (16 hosts after rulings:
 * orcarouter/infron/unorouter skipped — integrated registry providers;
 * freeairouter skipped — the pipeline's own feed; chatanywhere.tech
 * skipped — respected free-relay exclusion) enters the discovery pipeline
 * as operator-owned cards merged into the stage-0 stream by
 * `mergeSeedCards`. Seeds pass the IDENTICAL gate chain as feed hosts —
 * stage-0, typosquat screen, registry dedupe, LIVE auth-boundary probe —
 * no bypass branch exists.
 *
 * All seeds are `commercial-aggregator` / `categoryConfirmed: true` per
 * the operator's default-category ruling (2026-09-15).
 *
 * Removal: delete the host's entry here; the standard absent-from-run
 * drop behavior removes it from tracking (the same mechanism as the feed).
 */
import type { FeedCard } from './parse-feed'

export type SeedCard = {
  host: string
  url: string
  /** LIVE probe evidence at authorization time (read-only GET /v1/models). */
  probeNote: string
}

export const SEED_FID = 'FID-2026-0915-003'

export const SEED_HOSTS: readonly SeedCard[] = [
  {
    host: 'api.hcnsec.cn',
    url: 'https://api.hcnsec.cn',
    probeNote: 'boundary 401 on /v1/models (LIVE 2026-09-15)',
  },
  {
    host: 'chatwave.crunchflix.site',
    url: 'https://chatwave.crunchflix.site',
    probeNote: 'boundary 403 on /v1/models (LIVE 2026-09-15)',
  },
  {
    host: 'apinex.bond',
    url: 'https://apinex.bond',
    probeNote: 'boundary 401 on /v1/models (LIVE 2026-09-15)',
  },
  {
    host: 'nicked.bond',
    url: 'https://nicked.bond',
    probeNote: '404 root /v1/models, 530 api. — needs deeper discovery',
  },
  {
    host: 'b.ai',
    url: 'https://b.ai',
    probeNote: 'open 200 model list on /v1/models (LIVE 2026-09-15)',
  },
  {
    host: 'vyceai.com',
    url: 'https://vyceai.com',
    probeNote: 'boundary 401 on /v1/models (LIVE 2026-09-15)',
  },
  {
    host: 'gorouter.app',
    url: 'https://gorouter.app',
    probeNote: '502 on /v1/models at authorization time — retracked by probe',
  },
  {
    host: 'tabitoken.com',
    url: 'https://tabitoken.com',
    probeNote: 'boundary 401 on /v1/models (LIVE 2026-09-15)',
  },
  {
    host: 'kiraai.vn',
    url: 'https://kiraai.vn',
    probeNote: '301 on /v1/models — manual-redirect probe handles',
  },
  {
    host: 'www.tokenrouter.com',
    url: 'https://www.tokenrouter.com',
    probeNote: 'open 200 model list on /v1/models (LIVE 2026-09-15)',
  },
  {
    host: '9router.com',
    url: 'https://9router.com',
    probeNote: '404 on /v1/models — needs deeper discovery',
  },
  {
    host: 'use-llm.site',
    url: 'https://use-llm.site',
    probeNote: '404 on /v1/models — needs deeper discovery',
  },
  {
    host: 'platform.experientiallabs.ai',
    url: 'https://platform.experientiallabs.ai',
    probeNote: '307 on /v1/models — manual-redirect probe handles',
  },
  {
    host: 'monkeycode-ai.net',
    url: 'https://monkeycode-ai.net',
    probeNote: '405 on /v1/models — POST-only surface',
  },
  {
    host: 'tokenbom.com',
    url: 'https://tokenbom.com',
    probeNote: 'open 200 model list on /v1/models (LIVE 2026-09-15)',
  },
  {
    host: 'freetheai.xyz',
    url: 'https://freetheai.xyz',
    probeNote: '404 root, 401 via api. subdomain — pipeline discovers surface',
  },
]

/**
 * Map a seed into the feed-card shape with values stage-0 admits
 * (verified, confirmed aggregator category, reachable probe). The empty
 * roster keeps the diff fingerprint constant across runs — seeds never
 * churn as `changed`; the LIVE probe fills real evidence into lastProbe.
 */
export function toSeedFeedCard(seed: SeedCard): FeedCard {
  return {
    id: null,
    host: seed.host,
    url: seed.url,
    category: 'commercial-aggregator',
    categoryConfirmed: true,
    status: 'verified',
    kind: null,
    platform: null,
    freeQuotaEn: '',
    freeModelsEn: [],
    probe: {
      reachable: true,
      latencyMs: null,
      modelsCount: 0,
      modelsPublic: false,
      signupOpen: null,
      quotaHint: null,
    },
    firstSeenAt: null,
    lastProbedAt: null,
    discoveredFrom: `operator-seed:${SEED_FID}`,
  }
}

/**
 * Merge operator seeds into the parsed feed cards.
 *
 * Operator precedence (FID-2026-0915-003, corrected from the original
 * feed-precedence design after the LIVE run): an operator-authorized seed
 * OVERRIDES the feed's card for the same host — the feed's classification
 * must not defeat an explicit operator ruling (measured 2026-09-15: the
 * feed carries api.hcnsec.cn as categoryConfirmed:false and
 * freetheai.xyz as category=free-product, and both seeds silently fell
 * out at stage-0 under feed precedence). The safety gates are NOT
 * bypassed: typosquat screening and the LIVE open-relay probe still
 * apply to every card, seeds included. Deterministic: feed order kept,
 * overridden cards stay in place, remaining seeds appended in
 * declaration order.
 */
export function mergeSeedCards(
  feedCards: FeedCard[],
  seeds: readonly SeedCard[] = SEED_HOSTS,
): FeedCard[] {
  const seedByHost = new Map(seeds.map((seed) => [seed.host, seed]))
  const merged: FeedCard[] = []
  for (const card of feedCards) {
    const seed = seedByHost.get(card.host)
    if (seed !== undefined) {
      merged.push(toSeedFeedCard(seed))
      seedByHost.delete(card.host)
    } else {
      merged.push(card)
    }
  }
  for (const seed of seedByHost.values()) {
    merged.push(toSeedFeedCard(seed))
  }
  return merged
}
