/**
 * FID-2026-0916-001 — pipeline integrity pins.
 *
 * Covers the four T52 audit findings: the denylist accumulation
 * round-trip (bug), the silent-class exclusion audit rows, the propose
 * candidate-tracking guard, and the probe URL trust boundary.
 */
import { describe, expect, test } from 'bun:test'

import { buildExclusionAuditRows } from '../lib/audit-trail'
import { mergeDenylist } from '../lib/candidates-io'
import {
  isPrivateAddress,
  isPublicProbeUrl,
  probeEndpoint,
} from '../lib/probe-endpoint'
import { isTrackableCandidateHost } from '../lib/propose-guard'

import type { FeedCard } from '../lib/parse-feed'

// ---------------------------------------------------------------------------
// Finding 1 — denylist accumulation round-trip
// ---------------------------------------------------------------------------

const NOW_1 = '2026-09-15T10:00:00.000Z'
const NOW_2 = '2026-09-16T00:00:00.000Z'
const RELAY_ROW = {
  host: 'b.ai',
  decision: 'rejected',
  reason:
    'open relay — unauthenticated generation succeeded (LLMjacking class)',
} as const

describe('denylist accumulation (FID-2026-0916-001)', () => {
  test('accepts the persisted {_meta, entries} shape it itself writes', () => {
    const run1 = JSON.parse(
      mergeDenylist(undefined, [{ ...RELAY_ROW }], NOW_1),
    ) as { entries: Array<Record<string, string>> }
    expect(run1.entries).toHaveLength(1)

    // The exact failing sequence from the LIVE bug: run 2 reads back run 1's
    // object-shaped file with NO new audit rows — entries must survive.
    const run2 = JSON.parse(mergeDenylist(run1, [], NOW_2)) as {
      entries: Array<Record<string, string>>
    }
    expect(run2.entries).toHaveLength(1)
    expect(run2.entries[0]!.host).toBe('b.ai')
    expect(run2.entries[0]!.decision).toBe('rejected')
    // firstSeen preserved from the original sight, lastSeen from the file.
    expect(run2.entries[0]!.firstSeenUtc).toBe(NOW_1)
    expect(run2.entries[0]!.lastSeenUtc).toBe(NOW_1)
  })

  test('still accepts a legacy bare-array previous shape', () => {
    const out = JSON.parse(
      mergeDenylist(
        [{ host: 'legacy.example', reason: 'status=down (dead endpoint)' }],
        [],
        NOW_2,
      ),
    ) as { entries: Array<Record<string, string>> }
    expect(out.entries).toHaveLength(1)
    expect(out.entries[0]!.firstSeenUtc).toBe(NOW_2)
  })

  test('re-sighting the same host::reason bumps lastSeen, keeps firstSeen', () => {
    const run1 = JSON.parse(
      mergeDenylist(undefined, [{ ...RELAY_ROW }], NOW_1),
    ) as { entries: Array<Record<string, string>> }
    const run2 = JSON.parse(mergeDenylist(run1, [{ ...RELAY_ROW }], NOW_2)) as {
      entries: Array<Record<string, string>>
    }
    expect(run2.entries).toHaveLength(1)
    expect(run2.entries[0]!.firstSeenUtc).toBe(NOW_1)
    expect(run2.entries[0]!.lastSeenUtc).toBe(NOW_2)
  })

  test('new reasons for the same host append as separate entries', () => {
    const run1 = JSON.parse(
      mergeDenylist(undefined, [{ ...RELAY_ROW }], NOW_1),
    ) as { entries: Array<Record<string, string>> }
    const run2 = JSON.parse(
      mergeDenylist(
        run1,
        [{ host: 'b.ai', decision: 'flagged', reason: 'typosquat tier-2 — x' }],
        NOW_2,
      ),
    ) as { entries: Array<Record<string, string>> }
    expect(run2.entries).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Finding 2 — silent-class exclusion audit rows
// ---------------------------------------------------------------------------

function card(overrides: Partial<FeedCard>): FeedCard {
  return {
    id: null,
    host: 'example.test',
    url: 'https://example.test',
    category: 'commercial-aggregator',
    categoryConfirmed: true,
    status: 'verified',
    kind: null,
    platform: null,
    freeQuotaEn: '',
    freeModelsEn: [],
    probe: {
      reachable: true,
      latencyMs: 10,
      modelsCount: 3,
      modelsPublic: false,
      signupOpen: null,
      quotaHint: null,
    },
    firstSeenAt: null,
    lastProbedAt: null,
    discoveredFrom: null,
    ...overrides,
  }
}

describe('silent-class audit rows (FID-2026-0916-001)', () => {
  test('the three original classes keep their exact reason strings', () => {
    const rows = buildExclusionAuditRows([
      card({ host: 'a.test', status: 'risky' }),
      card({ host: 'b.test', category: 'free-relay' }),
      card({ host: 'c.test', status: 'down' }),
    ])
    expect(rows.map((r) => r.reason)).toEqual([
      'status=risky (MQ2 hard-exclusion)',
      'category=free-relay (anonymous relay class — LLMjacking)',
      'status=down (dead endpoint)',
    ])
    expect(rows.every((r) => r.decision === 'excluded')).toBe(true)
  })

  test('silent classes now render rows', () => {
    const rows = buildExclusionAuditRows([
      card({ host: 'd.test', categoryConfirmed: false }),
      card({ host: 'e.test', category: 'monitor-directory' }),
      card({
        host: 'f.test',
        category: 'free-product',
        categoryConfirmed: true,
      }),
      card({ host: 'g.test', probe: null }),
      card({
        host: 'h.test',
        probe: {
          reachable: false,
          latencyMs: null,
          modelsCount: 0,
          modelsPublic: false,
          signupOpen: null,
          quotaHint: null,
        },
      }),
    ])
    expect(rows).toHaveLength(5)
    expect(rows.map((r) => r.host)).toEqual([
      'd.test',
      'e.test',
      'f.test',
      'g.test',
      'h.test',
    ])
    expect(rows.every((r) => r.decision === 'excluded')).toBe(true)
    for (const row of rows) expect(row.reason.length).toBeGreaterThan(0)
  })

  test('a candidate-class card produces no row', () => {
    expect(buildExclusionAuditRows([card({ host: 'ok.test' })])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Finding 3 — propose candidate-tracking guard
// ---------------------------------------------------------------------------

const V2_STATE = JSON.stringify({
  _meta: { version: 2, hostCount: 2 },
  hosts: {
    'tracked.test': { fingerprint: 'habcdef01' },
    'relay.test': {
      fingerprint: 'h12345678',
      lastBoundary: 'open-relay-reject',
    },
  },
})

describe('propose tracking guard (FID-2026-0916-001)', () => {
  test('a tracked host (v2 shape) is scaffoldable', () => {
    expect(isTrackableCandidateHost('tracked.test', V2_STATE)).toBe(true)
  })
  test('a tracked host (legacy bare-map shape) is scaffoldable', () => {
    expect(
      isTrackableCandidateHost(
        'tracked.test',
        JSON.stringify({ 'tracked.test': { fingerprint: 'habcdef01' } }),
      ),
    ).toBe(true)
  })
  test('an untracked host fails closed', () => {
    expect(isTrackableCandidateHost('never-seen.test', V2_STATE)).toBe(false)
  })
  test('corrupt or absent state fails closed', () => {
    expect(isTrackableCandidateHost('tracked.test', 'not json {')).toBe(false)
    expect(isTrackableCandidateHost('tracked.test', '')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Finding 4 — probe URL trust boundary
// ---------------------------------------------------------------------------

describe('probe URL trust boundary (FID-2026-0916-001)', () => {
  test('public https URLs pass the static check', () => {
    expect(isPublicProbeUrl('https://api.example.ai/v1').ok).toBe(true)
    expect(
      isPublicProbeUrl('https://freeairouter.com/data/sites.json').ok,
    ).toBe(true)
  })

  test('wrong scheme, loopback, private ranges, and integer hosts reject', () => {
    expect(isPublicProbeUrl('http://api.example.ai/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://localhost/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://127.0.0.1/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://[::1]/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://10.1.2.3/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://172.16.0.9/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://192.168.1.1/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://169.254.169.254/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://2130706433/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://0x7f000001/v1').ok).toBe(false)
    expect(isPublicProbeUrl('https://0177.0.0.1/v1').ok).toBe(false)
  })

  test('isPrivateAddress classifies resolved IPs', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true)
    expect(isPrivateAddress('10.0.0.1')).toBe(true)
    expect(isPrivateAddress('172.31.255.255')).toBe(true)
    expect(isPrivateAddress('192.168.0.1')).toBe(true)
    expect(isPrivateAddress('169.254.169.254')).toBe(true)
    expect(isPrivateAddress('::1')).toBe(true)
    expect(isPrivateAddress('fd00::1')).toBe(true)
    expect(isPrivateAddress('fe80::1')).toBe(true)
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
    expect(isPrivateAddress('34.96.76.122')).toBe(false)
  })

  test('probeEndpoint refuses a guarded target without calling fetch', async () => {
    let calls = 0
    const result = await probeEndpoint({
      baseUrl: 'http://127.0.0.1:9/v1',
      fetchImpl: (async () => {
        calls++
        throw new Error('must not be called')
      }) as typeof fetch,
    })
    expect(calls).toBe(0)
    expect(result.reachable).toBe(false)
    expect(result.error).toContain('not a public probe target')
  })

  test('probeEndpoint allowPrivate skips the guard (Stage-E operator trust)', async () => {
    let calls = 0
    const result = await probeEndpoint({
      baseUrl: 'http://127.0.0.1:9/v1',
      allowPrivate: true,
      fetchImpl: (async () => {
        calls++
        throw new Error('stub network failure')
      }) as typeof fetch,
    })
    expect(calls).toBe(1)
    expect(result.reachable).toBe(false)
    expect(result.boundary).toBe('boundary-unverifiable')
  })
})
