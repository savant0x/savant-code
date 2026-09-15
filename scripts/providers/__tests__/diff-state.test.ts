/**
 * FID-2026-0915-002 (split 4) — diff/state pins, moved verbatim from
 * harvest-core.test.ts (the `diffCandidates (downStreak + 72h prune)` and
 * `candidates.json state shape (readable machine state)` describes).
 */
import { describe, expect, test } from 'bun:test'

import { card, DAY, T0 } from './helpers'
import {
  diffCandidates,
  parseStateFile,
  serializeStateFile,
  type CandidateState,
} from '../lib/diff-state'
import { parseFeedSites } from '../lib/parse-feed'

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
