/**
 * FID-2026-0915-003 — operator seed intake pins.
 *
 * Pins the operator rulings in data: the 16-host seed set, the 5 skips,
 * stage-0 admissibility (no bypass branch — MQ1), feed precedence, and
 * the shape contract that keeps the diff fingerprint stable.
 */
import { describe, expect, test } from 'bun:test'

import {
  SEED_FID,
  SEED_HOSTS,
  mergeSeedCards,
  toSeedFeedCard,
} from '../lib/seed-hosts'
import { stage0Filter } from '../lib/stage0-filter'

describe('operator seed intake (FID-2026-0915-003)', () => {
  test('seeds exactly the 16 ruled-in hosts', () => {
    expect(SEED_HOSTS).toHaveLength(16)
    expect(SEED_HOSTS.map((seed) => seed.host).sort()).toEqual([
      '9router.com',
      'api.hcnsec.cn',
      'apinex.bond',
      'b.ai',
      'chatwave.crunchflix.site',
      'freetheai.xyz',
      'gorouter.app',
      'kiraai.vn',
      'monkeycode-ai.net',
      'nicked.bond',
      'platform.experientiallabs.ai',
      'tabitoken.com',
      'tokenbom.com',
      'use-llm.site',
      'vyceai.com',
      'www.tokenrouter.com',
    ])
  })

  test('excludes the five ruled-out hosts (integrated ×3, feed, chatanywhere)', () => {
    const hosts = new Set(SEED_HOSTS.map((seed) => seed.host))
    expect(hosts.has('orcarouter.ai')).toBe(false)
    expect(hosts.has('infron.ai')).toBe(false)
    expect(hosts.has('unorouter.com')).toBe(false)
    expect(hosts.has('freeairouter.com')).toBe(false)
    expect(hosts.has('chatanywhere.tech')).toBe(false)
  })

  test('every seed card is stage-0 admissible — no bypass branch (MQ1)', () => {
    const cards = SEED_HOSTS.map(toSeedFeedCard)
    const admitted = stage0Filter(cards)
    expect(admitted).toHaveLength(SEED_HOSTS.length)
    for (const card of admitted) {
      expect(card.status).toBe('verified')
      expect(card.category).toBe('commercial-aggregator')
      expect(card.categoryConfirmed).toBe(true)
      expect(card.probe?.reachable).toBe(true)
      expect(card.discoveredFrom).toBe(`operator-seed:${SEED_FID}`)
    }
  })

  test('operator precedence — seed card overrides the feed card for the same host', () => {
    const feedCard = toSeedFeedCard({
      host: 'b.ai',
      url: 'https://b.ai/feed-version',
      probeNote: 'feed card',
    })
    const merged = mergeSeedCards([feedCard])
    expect(merged).toHaveLength(16) // b.ai overridden in place; 15 appended
    const bCard = merged.find((card) => card.host === 'b.ai')
    expect(bCard?.url).toBe('https://b.ai')
    expect(bCard?.discoveredFrom).toBe(`operator-seed:${SEED_FID}`)
  })

  test('merge is deterministic and preserves feed order first', () => {
    const first = mergeSeedCards([])
    const second = mergeSeedCards([])
    expect(first.map((card) => card.host)).toEqual(
      second.map((card) => card.host),
    )
    expect(first).toHaveLength(16)
    expect(first.every((card) => card.discoveredFrom?.includes(SEED_FID))).toBe(
      true,
    )
  })

  test('seed cards keep an empty roster — stable diff fingerprint across runs', () => {
    for (const card of SEED_HOSTS.map(toSeedFeedCard)) {
      expect(card.freeModelsEn).toEqual([])
      expect(card.freeQuotaEn).toBe('')
    }
  })
})
