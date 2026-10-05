/**
 * FID-2026-1004-007 — new-candidate inbox routing pins. Only NEW discovery
 * candidates become `candidate` facts (`changed` is excluded — probe jitter
 * would flood the inbox); observe is fail-silent and forwards the artifact
 * mtime as the freshness anchor.
 */
import { describe, expect, test } from 'bun:test'

import { buildDiscoveryFacts, observeDiscoveryCandidates } from '../discovery-inbox'

import type { DiscoveryCounts } from '../discovery-announce'
import type { ProviderFact } from '@savant-code/common/providers/provider-notifications'

const COUNTS: DiscoveryCounts = {
  setKey: 'k',
  observedAtMs: 1_000,
  newCount: 2,
  changedCount: 5,
  newHosts: ['a.example', 'b.example'],
}

describe('FID-2026-1004-007: new-candidate inbox facts', () => {
  test('one candidate fact per NEW host — info, unselected, value "new"', () => {
    const facts = buildDiscoveryFacts(COUNTS)
    expect(facts).toHaveLength(2)
    expect(facts.map((f) => f.providerId)).toEqual(['a.example', 'b.example'])
    for (const fact of facts) {
      expect(fact.kind).toBe('candidate')
      expect(fact.severity).toBe('info')
      expect(fact.selected).toBe(false)
      expect(fact.value).toBe('new')
      expect(fact.key).toBe(`candidate:${fact.providerId}`)
    }
  })

  test('no new hosts → no facts (changed hosts never route)', () => {
    expect(buildDiscoveryFacts({ ...COUNTS, newHosts: [] })).toEqual([])
  })

  test('observe forwards the source + artifact mtime', () => {
    const calls: Array<{ source: string; facts: ProviderFact[]; at?: number }> =
      []
    observeDiscoveryCandidates(COUNTS, {
      observe: (source, facts, at) => {
        calls.push({ source, facts, at })
      },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.source).toBe('discovery')
    expect(calls[0]?.at).toBe(1_000)
    expect(calls[0]?.facts).toHaveLength(2)
  })

  test('a throwing sink never propagates (fail-silent)', () => {
    expect(() =>
      observeDiscoveryCandidates(COUNTS, {
        observe: () => {
          throw new Error('sink down')
        },
      }),
    ).not.toThrow()
  })

  test('no new hosts → no observe call', () => {
    let called = 0
    observeDiscoveryCandidates({ ...COUNTS, newHosts: [] }, {
      observe: () => {
        called++
      },
    })
    expect(called).toBe(0)
  })
})