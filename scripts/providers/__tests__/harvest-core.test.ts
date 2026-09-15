/**
 * FID-2026-0914-003 — harvest core pins (RED-first).
 *
 * Pure-logic contracts of the discovery pipeline: feed parsing, the stage-0
 * filter, the two-tier typosquat screen, the unauthenticated-boundary verdict,
 * diff/prune state, the MQ8 stable report, and the dev-dir write guard.
 * Fixtures are trimmed slices shaped exactly like the real payload observed
 * 2026-09-14 — no live network in tests.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  diffCandidates,
  parseStateFile,
  serializeStateFile,
  type CandidateState,
} from '../lib/diff-state'
import { parseFeedSites } from '../lib/parse-feed'
import { classifyUnauthBoundary, probeEndpoint } from '../lib/probe-endpoint'
import { renderReport, writeReportStable } from '../lib/report'
import { stage0Filter } from '../lib/stage0-filter'
import { assertWithinDev, typosquatVerdict } from '../lib/typosquat'

/** Frozen card slice — mirrors the real feed record shape. */
function card(overrides: Record<string, unknown>): {
  card: Record<string, unknown>
} {
  return {
    card: {
      id: 1,
      host: 'api.example-free.ai',
      url: 'https://api.example-free.ai',
      name: 'api.example-free.ai',
      kind: 'product',
      platform: 'openai-compatible',
      category: 'first-party-free',
      categoryConfirmed: true,
      isPrimary: true,
      status: 'verified',
      discoveredFrom: 'for-the-zero/Free-LLM-Collection',
      firstSeenAt: '2026-08-01T00:00:00.000Z',
      lastProbedAt: '2026-09-14T00:00:57.771Z',
      lastAnalyzedAt: null,
      freeQuota: null,
      freeQuota_en: 'Free tier: 1M tokens/day, no card',
      freeModels: [],
      freeModels_en: ['llama-3.3-70b', 'qwen-3-32b'],
      probe: {
        reachable: true,
        latencyMs: 320,
        modelsCount: 12,
        modelsPublic: false,
        signupOpen: null,
        quotaHint: null,
      },
      analysis: null,
      upstream: null,
      ...overrides,
    },
  }
}

const DAY = 24 * 60 * 60 * 1000
const T0 = 1_757_800_000_000 // 2026-09-14-ish epoch ms (fixture clock)

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

describe('classifyUnauthBoundary (401-boundary gate)', () => {
  test('401/403 = boundary-ok (the A8 positive controls)', () => {
    expect(classifyUnauthBoundary(401)).toBe('boundary-ok')
    expect(classifyUnauthBoundary(403)).toBe('boundary-ok')
  })

  test('any 2xx = open-relay-reject (the LLMjacking class)', () => {
    expect(classifyUnauthBoundary(200)).toBe('open-relay-reject')
    expect(classifyUnauthBoundary(204)).toBe('open-relay-reject')
  })

  test('404/5xx/network-null = boundary-unverifiable (flagged, not rejected)', () => {
    expect(classifyUnauthBoundary(404)).toBe('boundary-unverifiable')
    expect(classifyUnauthBoundary(500)).toBe('boundary-unverifiable')
    expect(classifyUnauthBoundary(null)).toBe('boundary-unverifiable')
  })

  test('probeEndpoint maps fetch outcomes through the same verdicts (injected fetch)', async () => {
    const ok = await probeEndpoint({
      baseUrl: 'https://api.example-free.ai',
      fetchImpl: (async (url: string, init?: RequestInit) => {
        if (String(url).endsWith('/v1/models')) {
          return new Response(JSON.stringify({ data: [{ id: 'm1' }] }), {
            status: 200,
          })
        }
        return new Response(null, { status: 401 }) // chat/completions dummy
      }) as typeof fetch,
    })
    expect(ok.modelsCount).toBe(1)
    expect(ok.boundary).toBe('boundary-ok')

    const open = await probeEndpoint({
      baseUrl: 'https://open.relay.example',
      fetchImpl: (async () =>
        new Response('ok', { status: 200 })) as typeof fetch,
    })
    expect(open.boundary).toBe('open-relay-reject')

    const dead = await probeEndpoint({
      baseUrl: 'https://dead.example',
      fetchImpl: (async () => {
        throw new TypeError('fetch failed')
      }) as typeof fetch,
    })
    expect(dead.boundary).toBe('boundary-unverifiable')
    expect(dead.modelsCount).toBe(0)
  })

  test('boundary POST survives an apex→www 301 (re-POST: method AND body intact)', async () => {
    // LIVE-caught defect (2026-09-15, orcarouter.ai): fetch rewrites POST→GET
    // on 301/302, so auto-followed redirects turned the boundary probe into a
    // GET — every relay fronted by an apex→www redirect was misclassified
    // boundary-unverifiable. The probe must re-issue the POST itself.
    const calls: Array<{ url: string; method: string; body: unknown }> = []
    const result = await probeEndpoint({
      baseUrl: 'https://orcarouter.example',
      fetchImpl: (async (url: string, init?: RequestInit) => {
        const u = String(url)
        if (u.endsWith('/v1/models')) {
          return new Response(JSON.stringify({ data: [{ id: 'm1' }] }), {
            status: 200,
          })
        }
        calls.push({ url: u, method: init?.method ?? 'GET', body: init?.body })
        if (u === 'https://orcarouter.example/v1/chat/completions') {
          // First hop: the apex→www redirect (fetch would degrade to GET here).
          return new Response(null, {
            status: 301,
            headers: {
              Location:
                'https://www.orcarouter.example/v1/chat/completions',
            },
          })
        }
        return new Response(null, { status: 401 }) // the real boundary answer
      }) as typeof fetch,
    })
    expect(result.boundary).toBe('boundary-ok')
    expect(calls.length).toBe(2)
    expect(calls[0]!.method).toBe('POST')
    expect(calls[1]!.url).toBe(
      'https://www.orcarouter.example/v1/chat/completions',
    )
    // The whole point: the re-issued request is still a POST WITH a body.
    expect(calls[1]!.method).toBe('POST')
    expect(typeof calls[1]!.body).toBe('string')
  })

  test('relative redirect Locations resolve against the current URL; hop bound is graceful', async () => {
    const result = await probeEndpoint({
      baseUrl: 'https://relay.example',
      fetchImpl: (async (url: string) => {
        const u = String(url)
        if (u.endsWith('/v1/models')) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 })
        }
        if (u === 'https://relay.example/v1/chat/completions') {
          return new Response(null, {
            status: 302,
            headers: { Location: '/v1/chat/completions' },
          })
        }
        // Always redirect again → hop bound must trip, not loop forever.
        return new Response(null, {
          status: 302,
          headers: { Location: '/v1/chat/completions' },
        })
      }) as typeof fetch,
    })
    // Hop exhaustion is a measurement failure, not a crash: unverifiable.
    expect(result.boundary).toBe('boundary-unverifiable')
  })
})

describe('diffCandidates (downStreak + 72h prune)', () => {
  const A = card({ host: 'a.new' })
  const B = card({ host: 'b.seen', freeModels_en: ['m1'] })

  test('first sight = new; unchanged re-sight = unchanged', () => {
    const first = diffCandidates(new Map(), parseFeedSites([A, B]), T0)
    expect(first.entries.map((e) => e.classification)).toEqual(['new', 'new'])
    const second = diffCandidates(first.next, parseFeedSites([A, B]), T0 + DAY)
    expect(second.entries.map((e) => e.classification)).toEqual([
      'unchanged',
      'unchanged',
    ])
  })

  test('fingerprint change (model list delta) = changed', () => {
    const first = diffCandidates(new Map(), parseFeedSites([B]), T0)
    const mutated = parseFeedSites([
      card({ host: 'b.seen', freeModels_en: ['m1', 'm2'] }),
    ])
    const second = diffCandidates(first.next, mutated, T0 + DAY)
    expect(second.entries[0].classification).toBe('changed')
  })

  test('fingerprint derives from MODELS ONLY — quota prose edits are noise', () => {
    // The feed rewrites its English quota text constantly (LLM synthesis);
    // a wording change alone must NOT reclassify a host as changed. B's
    // models are re-asserted explicitly: card() defaults would otherwise
    // make this a models-delta test instead of a prose-noise test.
    const first = diffCandidates(new Map(), parseFeedSites([B]), T0)
    const reworded = parseFeedSites([
      card({
        host: 'b.seen',
        freeModels_en: ['m1'],
        freeQuota_en: 'Completely different wording about the same tier.',
      }),
    ])
    const second = diffCandidates(first.next, reworded, T0 + DAY)
    expect(second.entries[0].classification).toBe('unchanged')
  })

  test('down streak accumulates and lapses at 3 (72h rule); memory persists', () => {
    const alive = parseFeedSites([B])
    const down = parseFeedSites([card({ host: 'b.seen', status: 'down' })])
    const d1 = diffCandidates(new Map(), alive, T0)
    const d2 = diffCandidates(d1.next, down, T0 + DAY)
    expect(d2.entries[0].downStreak).toBe(1)
    const d3 = diffCandidates(d2.next, down, T0 + 2 * DAY)
    expect(d3.entries[0].downStreak).toBe(2)
    const d4 = diffCandidates(d3.next, down, T0 + 3 * DAY)
    expect(d4.entries[0].classification).toBe('lapsed')
    expect(d4.next.has('b.seen')).toBe(false) // pruned from tracking
    // A lapsed host that returns is new again.
    const d5 = diffCandidates(d4.next, alive, T0 + 4 * DAY)
    expect(d5.entries[0].classification).toBe('new')
  })

  test('boundary evidence CARRIES FORWARD for unchanged hosts (day-two erosion bug)', () => {
    // Day-two LIVE run catch (2026-09-14): the harvester's post-probe patch
    // only touches new/changed hosts, so diffCandidates' rebuild wiped a
    // day-1 open-relay verdict to null on an unchanged re-sight — letting
    // the wizard prefill an open relay on day two. The standing verdict
    // must survive every run that does not re-measure it.
    const alive = parseFeedSites([B])
    const first = diffCandidates(new Map(), alive, T0)
    // Simulate the harvester's post-probe patch: probed on day 1.
    const withVerdict = first.next
    withVerdict.set('b.seen', {
      ...withVerdict.get('b.seen')!,
      lastBoundary: 'open-relay-reject',
    })
    // Day 2: unchanged re-sight, NOT re-probed (no boundaryVerdict).
    const second = diffCandidates(withVerdict, parseFeedSites([B]), T0 + DAY)
    expect(second.entries[0].classification).toBe('unchanged')
    expect(second.next.get('b.seen')?.lastBoundary).toBe('open-relay-reject')
  })

  test('state map round-trips through plain JSON (candidates.json contract)', () => {
    const first = diffCandidates(new Map(), parseFeedSites([B]), T0)
    const serialized = JSON.stringify(Object.fromEntries(first.next))
    const restored = new Map(Object.entries(JSON.parse(serialized))) as Map<
      string,
      CandidateState
    >
    const second = diffCandidates(restored, parseFeedSites([B]), T0 + DAY)
    expect(second.entries[0].classification).toBe('unchanged')
  })
})

describe('candidates.json state shape (readable machine state)', () => {
  // Local fixture (B lives inside the diffCandidates describe scope).
  const S = card({ host: 'b.state', freeModels_en: ['m1'] })

  test('serializes with a _meta header + hosts wrapper and hashed fingerprints', () => {
    const first = diffCandidates(new Map(), parseFeedSites([S]), T0)
    const json = serializeStateFile(first.next)
    const parsed = JSON.parse(json) as {
      _meta: Record<string, unknown>
      hosts: Record<string, Record<string, unknown>>
    }
    // v2 (FID-2026-0915-001): history/models/firstSeen added, version bumped.
    expect(parsed._meta.version).toBe(2)
    expect(typeof parsed._meta.savedAtUtc).toBe('string')
    expect(Object.keys(parsed.hosts).length).toBe(1)
    const entry = parsed.hosts['b.state']
    // The full prose fingerprint is gone; an 8-hex hash stands in.
    expect(entry.fingerprint).toMatch(/^h[0-9a-f]{8}$/)
    expect(JSON.stringify(entry).length).toBeLessThan(400)
  })

  test('parses its own output (round-trip) and keeps diffing correctly', () => {
    const first = diffCandidates(new Map(), parseFeedSites([S]), T0)
    const restored = parseStateFile(serializeStateFile(first.next))
    const second = diffCandidates(restored, parseFeedSites([S]), T0 + DAY)
    expect(second.entries[0].classification).toBe('unchanged')
  })

  test('legacy bare-map state parses with zero re-classification blip', () => {
    const legacy = diffCandidates(new Map(), parseFeedSites([S]), T0)
    const legacyJson = JSON.stringify(Object.fromEntries(legacy.next))
    const restored = parseStateFile(legacyJson)
    const second = diffCandidates(restored, parseFeedSites([S]), T0 + DAY)
    expect(second.entries[0].classification).toBe('unchanged')
  })

  test('legacy PROSE fingerprints migrate to models-only hashes with ZERO blip', () => {
    // The real legacy file stores fingerprint = JSON.stringify([models,
    // quotaProse, status]). Migration must extract the models element and
    // hash it — bit-identical to a fresh diffCandidates compute — so the
    // first post-upgrade run still classifies unchanged hosts as unchanged.
    const legacyModels = ['llama-3.3-70b', 'qwen-3-32b']
    const legacyProse = JSON.stringify([
      legacyModels,
      'quota prose here',
      'verified',
    ])
    const legacyJson = JSON.stringify({
      'b.state': {
        category: 'first-party-free',
        fingerprint: legacyProse,
        downStreak: 0,
        lastSeenUtc: '2026-09-14T00:00:00.000Z',
        url: 'https://b.state',
        lastBoundary: 'boundary-ok',
        lastProbe: null,
      },
    })
    const restored = parseStateFile(legacyJson)
    // Today's card has the SAME models → must diff as unchanged.
    const todayCard = card({ host: 'b.state', freeModels_en: legacyModels })
    const second = diffCandidates(
      restored,
      parseFeedSites([todayCard]),
      T0 + DAY,
    )
    expect(second.entries[0].classification).toBe('unchanged')
  })

  test('legacy prose fingerprints hash deterministically across parses', () => {
    const legacy = diffCandidates(new Map(), parseFeedSites([S]), T0)
    const legacyJson = JSON.stringify(Object.fromEntries(legacy.next))
    const a = parseStateFile(legacyJson)
    const b = parseStateFile(legacyJson)
    expect(a.get('b.state')?.fingerprint).toBe(b.get('b.state')?.fingerprint)
    // And the hashed form must be deterministic (same input → same hash).
    expect(a.get('b.state')?.fingerprint).toMatch(/^h[0-9a-f]{8}$/)
  })

  test('corrupt or alien JSON parses to an empty map (fail-silent)', () => {
    expect(parseStateFile('{not json').size).toBe(0)
    expect(parseStateFile('"just a string"').size).toBe(0)
    expect(
      parseStateFile(JSON.stringify({ _meta: { version: 1 }, hosts: 'nope' }))
        .size,
    ).toBe(0)
  })
})

describe('renderReport + writeReportStable (MQ8)', () => {
  const reportInput = {
    fetchedAtUtc: '2026-09-14T18:48:23Z',
    totalRecords: 214,
    stage0Count: 2,
    candidates: [
      {
        host: 'api.example-free.ai',
        category: 'first-party-free',
        modelsCount: 12,
        latencyMs: 320,
        boundary: 'boundary-ok' as const,
        typosquat: 'pass' as const,
      },
    ],
    auditTrail: [
      {
        host: 'api.celebras.ai',
        decision: 'rejected',
        reason: 'typosquat tier-1: distance 1 from api.cerebras.ai',
      },
      {
        host: 'a.risky',
        decision: 'excluded',
        reason: 'status=risky (MQ2 hard-exclusion)',
      },
      {
        host: 'a.relay',
        decision: 'excluded',
        reason: 'category=free-relay (anonymous relay class)',
      },
    ],
    sections: {
      newHosts: ['api.example-free.ai'],
      changedHosts: [] as string[],
      lapsedHosts: [] as string[],
      health: [] as Array<{ host: string; verdict: string }>,
    },
  }

  test('report carries header, candidate table, and a reason for every audit row', () => {
    const md = renderReport(reportInput)
    expect(md).toContain('2026-09-14T18:48:23Z')
    expect(md).toContain('api.example-free.ai')
    // Display contract: boundary-ok renders as 'ok' in the table.
    expect(md).toContain('| ok |')
    // Data-backed: every audit decision cites its reason in its group
    // heading (counted groups carry the reason for every member host).
    expect(md).toContain('### Excluded · status=risky (MQ2 hard-exclusion) — 1')
    expect(md).toContain(
      '### Excluded · category=free-relay (anonymous relay class — LLMjacking) — 1',
    )
    // Tier-1 rejections group under their reason.
    expect(md).toContain('### Rejected · typosquat tier-1 — 1')
    expect(md).toContain('api.celebras.ai')
  })

  test('professional structure: summary table, grouped sorted candidates, counted audit', () => {
    const md = renderReport({
      ...reportInput,
      candidates: [
        {
          host: 'a.ok-many',
          category: 'first-party-free',
          modelsCount: 12,
          latencyMs: 200,
          boundary: 'boundary-ok',
          typosquat: 'pass',
          classification: 'unchanged',
          downStreak: 0,
          models: [
            'llama-3.3-70b',
            'qwen3-coder',
            'glm-4.5-air',
            'gpt-oss-120b',
            'gemma-4-31b',
            'nemotron-ultra',
            'deepseek-v4',
            'kimi-k2',
          ],
        },
        {
          host: 'b.ok-few',
          category: 'first-party-free',
          modelsCount: 0,
          latencyMs: 300,
          boundary: 'boundary-ok',
          typosquat: 'pass',
          classification: 'unchanged',
          downStreak: 0,
          models: ['jamba-large', 'jamba-mini'],
        },
        {
          host: 'c.unverified',
          category: 'first-party-free',
          modelsCount: null,
          latencyMs: 100,
          boundary: 'boundary-unverifiable',
          typosquat: 'pass',
          classification: 'new',
          downStreak: 0,
          models: [],
        },
        {
          host: 'd.relay',
          category: 'commercial-aggregator',
          modelsCount: 5,
          latencyMs: 90,
          boundary: 'open-relay-reject',
          typosquat: 'pass',
          classification: 'unchanged',
          downStreak: 0,
          models: [],
        },
      ],
      auditTrail: [
        {
          host: 'demo.voapi.top',
          decision: 'excluded',
          reason: 'status=risky (MQ2 hard-exclusion)',
        },
        {
          host: 'routerpark.com',
          decision: 'excluded',
          reason: 'status=risky (MQ2 hard-exclusion)',
        },
        {
          host: 'api.celebras.ai',
          decision: 'excluded',
          reason: 'status=down (dead endpoint)',
        },
        {
          host: 'open.relay',
          decision: 'rejected',
          reason:
            'open relay — unauthenticated generation succeeded (LLMjacking class)',
        },
        {
          host: 'api.cohere.ai',
          decision: 'flagged',
          reason:
            'typosquat tier-2 — closest vendor host api.cohere.com at Levenshtein distance 3',
        },
      ],
      sections: {
        newHosts: ['c.unverified'],
        changedHosts: [],
        lapsedHosts: [],
        health: [],
      },
    })
    // Executive summary first.
    expect(md.indexOf('## Summary')).toBeLessThan(md.indexOf('## Candidates'))
    expect(md).toContain('Stage-0 candidates')
    // Candidates grouped by category, sorted by readiness (ok+models first).
    expect(md).toContain('### First-party free tiers')
    expect(md).toContain('### Commercial aggregators')
    // Order within the CANDIDATES section (the changes section names
    // c.unverified first, so a bare indexOf would false-fail).
    const candSection = md.slice(
      md.indexOf('## Candidates by readiness'),
      md.indexOf('## Audit trail'),
    )
    expect(candSection.indexOf('a.ok-many')).toBeLessThan(
      candSection.indexOf('c.unverified'),
    )
    expect(candSection.indexOf('b.ok-few')).toBeLessThan(
      candSection.indexOf('c.unverified'),
    )
    // Models available: probed count renders plain; feed-listed count
    // carries the † marker (0 from the probe ≠ no models); no models = —.
    // The roster itself is capped (6 names + a +K more tail).
    expect(candSection).toContain('Model availability')
    expect(candSection).toContain('**a.ok-many** (12 probed)')
    expect(candSection).toContain('(+2 more)')
    expect(candSection).toContain('**b.ok-few** (2 feed-listed†)')
    expect(candSection).toContain('jamba-large, jamba-mini')
    // Nothing measured (no probe count, no feed list) renders '—',
    // never a fabricated count (line-scoped to the host's row).
    for (const line of candSection.split('\n')) {
      if (line.startsWith('| c.unverified ')) {
        expect(line).toContain('| — |')
      }
    }
    // The 'Models' column never lies: feed-listed count shows as N†,
    // never a bare 0 for a host whose list is merely hidden.
    expect(candSection).toContain('| 2† |')
    expect(candSection).not.toContain('| 0 |')
    // Constant noise is suppressed, standing verdicts are shown.
    expect(md).not.toContain('not-probed-this-run')
    expect(md).toContain('RELAY')
    // The relay host is demoted to the bottom of its group.
    expect(md.indexOf('c.unverified')).toBeLessThan(md.indexOf('d.relay'))
    // Audit trail is counted + grouped, not a one-bullet-per-host dump.
    expect(md).toContain('### Excluded · status=risky (MQ2 hard-exclusion) — 2')
    expect(md).toContain('### Rejected · open relay — 1')
    // Completeness: every host still present, flagged keeps its reason.
    for (const h of [
      'demo.voapi.top',
      'routerpark.com',
      'api.celebras.ai',
      'open.relay',
    ]) {
      expect(md).toContain(h)
    }
    expect(md).toContain('api.cohere.com')
    // Changes section only exists when there are changes.
    expect(md).toContain("This run's changes")
    const stable = renderReport({
      ...reportInput,
      sections: { newHosts: [], changedHosts: [], lapsedHosts: [], health: [] },
    })
    expect(stable).not.toContain("This run's changes")
  })

  test('stable path: a second write REPLACES, never appends (MQ8)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fa-report-'))
    try {
      writeReportStable(
        'dev/provider-candidates',
        '# run one\nold content',
        undefined,
        () => dir,
      )
      const first = readFileSync(
        join(dir, 'dev/provider-candidates/report.md'),
        'utf8',
      )
      expect(first).toContain('run one')
      writeReportStable(
        'dev/provider-candidates',
        '# run two\nnew content',
        undefined,
        () => dir,
      )
      const second = readFileSync(
        join(dir, 'dev/provider-candidates/report.md'),
        'utf8',
      )
      expect(second).toContain('run two')
      expect(second).not.toContain('old content')
      expect(second).toBe('# run two\nnew content')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('writeReportStable also replaces candidates.json state in place', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fa-state-'))
    try {
      writeReportStable(
        'dev/provider-candidates',
        '# r',
        JSON.stringify({ v: 1 }),
        () => dir,
      )
      writeReportStable(
        'dev/provider-candidates',
        '# r',
        JSON.stringify({ v: 2 }),
        () => dir,
      )
      const state = JSON.parse(
        readFileSync(
          join(dir, 'dev/provider-candidates/candidates.json'),
          'utf8',
        ),
      )
      expect(state.v).toBe(2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('assertWithinDev (no-write-outside-dev guard)', () => {
  test('accepts dev-relative output paths', () => {
    expect(() =>
      assertWithinDev('dev/provider-candidates/report.md'),
    ).not.toThrow()
    expect(() => assertWithinDev('dev/scratchpad/proposal.md')).not.toThrow()
  })

  test('throws on anything outside dev/ (traversal and absolute)', () => {
    expect(() => assertWithinDev('src/providers/registry.ts')).toThrow()
    expect(() => assertWithinDev('../outside.md')).toThrow()
    expect(() => assertWithinDev('dev/../package.json')).toThrow()
    expect(() => assertWithinDev('package.json')).toThrow()
  })
})
