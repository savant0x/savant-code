/**
 * FID-2026-0914-003 — harvest core pins (RED-first).
 *
 * Pure-logic contracts of the discovery pipeline: feed parsing, the stage-0
 * filter, and the two-tier typosquat screen. Fixtures are trimmed slices
 * shaped exactly like the real payload observed 2026-09-14 — no live
 * network in tests.
 *
 * FID-2026-0915-002 (split 4): the boundary/probe, diff/state, and report
 * pins moved to probe-boundary.test.ts, diff-state.test.ts, and
 * report-stable.test.ts; this file keeps the core parse/filter/screen
 * describes. Shared fixtures live in helpers.ts.
 */
import { describe, expect, test } from 'bun:test'

import { card } from './helpers'
import { parseFeedSites } from '../lib/parse-feed'
import { stage0Filter } from '../lib/stage0-filter'
import { typosquatVerdict } from '../lib/typosquat'

describe('parseFeedSites', () => {
  test('normalizes {card} records and tolerates missing optional fields', () => {
    const raw = [
      card({}),
      // Minimal record: no probe, no analysis, no freeQuota fields at all.
      { card: { id: 2, host: 'b.minimal.dev', status: 'down' } },
      // Malformed entry is skipped, not thrown.
      { nope: true },
      'garbage',
    ]
    const cards = parseFeedSites(raw)
    expect(cards.length).toBe(2)
    expect(cards[0].host).toBe('api.example-free.ai')
    expect(cards[0].category).toBe('first-party-free')
    expect(cards[0].status).toBe('verified')
    expect(cards[0].probe?.reachable).toBe(true)
    expect(cards[0].freeModelsEn).toEqual(['llama-3.3-70b', 'qwen-3-32b'])
    expect(cards[1].host).toBe('b.minimal.dev')
    expect(cards[1].probe).toBeNull()
    expect(cards[1].freeModelsEn).toEqual([])
  })

  test('never trusts the rendered label: status domain is verified/risky/down', () => {
    // A1: the site renders "Up" but the data value is `verified` — the
    // parser must pass the raw value through unchanged.
    const cards = parseFeedSites([card({ status: 'verified' })])
    expect(cards[0].status).toBe('verified')
  })
})

describe('stage0Filter', () => {
  test('keeps verified+reachable+confirmed first-party/aggregator records', () => {
    const cards = parseFeedSites([
      card({}),
      card({ host: 'gw.example.dev', category: 'commercial-aggregator' }),
    ])
    const kept = stage0Filter(cards)
    expect(kept.map((c) => c.host)).toEqual([
      'api.example-free.ai',
      'gw.example.dev',
    ])
  })

  test('hard-excludes risky, down, relays, unconfirmed, and null categories', () => {
    const cards = parseFeedSites([
      card({ host: 'a.risky', status: 'risky' }), // MQ2: hard-excluded
      card({ host: 'a.down', status: 'down' }),
      card({ host: 'a.relay', category: 'free-relay' }), // LLMjacking class
      card({ host: 'a.unconfirmed', categoryConfirmed: false }),
      card({ host: 'a.nullcat', category: null, categoryConfirmed: false }),
      card({
        host: 'a.unreachable',
        probe: { reachable: false, latencyMs: 9 },
      }),
      card({ host: 'a.monitor', category: 'monitor-directory' }),
    ])
    expect(stage0Filter(cards)).toEqual([])
  })
})

describe('typosquatVerdict (two-tier screen)', () => {
  test('tier 1: api.celebras.ai is rejected (distance-1, not allowlisted)', () => {
    expect(typosquatVerdict('api.celebras.ai')).toBe('reject')
  })

  test('tier 1 allowlist: api.z.ai passes despite distance-1 to api.x.ai', () => {
    // Loop-3 correction: a naive hard-fail banned a legitimate vendor.
    expect(typosquatVerdict('api.z.ai')).toBe('pass')
  })

  test('tier 1 is case-insensitive and boundary-exact', () => {
    // Measured: API.CEFEBRAS.AI lowercases to distance-1 from api.cerebras.ai
    // → an uppercased lookalike is still caught…
    expect(typosquatVerdict('API.CEFEBRAS.AI')).toBe('reject')
    // …while the exact real vendor host (any case) always passes.
    expect(typosquatVerdict('api.cerebras.ai')).toBe('pass')
    expect(typosquatVerdict('API.CEREBRAS.AI')).toBe('pass')
  })

  test('tier 2: distance 3-4 is flagged for review, never silently dropped', () => {
    // Measured distances: api.groqqz.com = 2 (tier 1 reject);
    // api.gr0qzz.com = 3 (tier 2 flag: o→0 sub + two insertions);
    // api.groq-community.net = 11 (pass — clearly its own brand).
    expect(typosquatVerdict('api.groqqz.com')).toBe('reject')
    expect(typosquatVerdict('api.gr0qzz.com')).toBe('flag')
  })

  test('distance >= 5 passes clean', () => {
    expect(typosquatVerdict('api.my-new-startup-free.ai')).toBe('pass')
  })
})
