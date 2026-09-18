/**
 * FID-2026-0918-002 — RED-first pins for the 3-day re-probe cadence on
 * `boundary-unverifiable` hosts. Written BEFORE the implementation exists;
 * these fail until health.ts gains the cadence gate and the state layer
 * carries `lastProbeAttemptUtc`. All pure logic — no network, no disk.
 */
import { describe, expect, test } from 'bun:test'

import {
  type CandidateState,
  diffCandidates,
  parseStateFile,
} from '@savant-code/common/providers/discovery-state'

import {
  UNVERIFIABLE_REPROBE_DAYS,
  withProbeAttempt,
  shouldReprobeUnverifiable,
} from '../lib/health'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-18T12:00:00.000Z')

function iso(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString()
}

describe('UNVERIFIABLE_REPROBE_DAYS (FID-2026-0918-002)', () => {
  test('shares the 72h grace-rule number (one truth, Law 13)', () => {
    expect(UNVERIFIABLE_REPROBE_DAYS).toBe(3)
  })
})

describe('shouldReprobeUnverifiable', () => {
  test('non-unverifiable hosts never re-probe via this gate', () => {
    expect(
      shouldReprobeUnverifiable({ lastBoundary: 'boundary-ok' }, NOW),
    ).toBe(false)
    expect(
      shouldReprobeUnverifiable({ lastBoundary: null }, NOW),
    ).toBe(false)
    expect(
      shouldReprobeUnverifiable(
        { lastBoundary: 'open-relay-reject' },
        NOW,
      ),
    ).toBe(false)
  })

  test('never-attempted host (pre-cadence state) probes now', () => {
    expect(
      shouldReprobeUnverifiable(
        { lastBoundary: 'boundary-unverifiable' },
        NOW,
      ),
    ).toBe(true)
  })

  test('fresh attempt (<3 days) skips the re-probe', () => {
    expect(
      shouldReprobeUnverifiable(
        { lastBoundary: 'boundary-unverifiable', lastProbeAttemptUtc: iso(1 * DAY_MS) },
        NOW,
      ),
    ).toBe(false)
    expect(
      shouldReprobeUnverifiable(
        { lastBoundary: 'boundary-unverifiable', lastProbeAttemptUtc: iso(2 * DAY_MS) },
        NOW,
      ),
    ).toBe(false)
  })

  test('stale attempt (>=3 days) re-probes; exactly 3 days is stale', () => {
    expect(
      shouldReprobeUnverifiable(
        { lastBoundary: 'boundary-unverifiable', lastProbeAttemptUtc: iso(3 * DAY_MS) },
        NOW,
      ),
    ).toBe(true)
    expect(
      shouldReprobeUnverifiable(
        { lastBoundary: 'boundary-unverifiable', lastProbeAttemptUtc: iso(4 * DAY_MS) },
        NOW,
      ),
    ).toBe(true)
  })

  test('malformed attempt timestamp fails OPEN to probing (conservative)', () => {
    expect(
      shouldReprobeUnverifiable(
        { lastBoundary: 'boundary-unverifiable', lastProbeAttemptUtc: 'not-a-date' },
        NOW,
      ),
    ).toBe(true)
  })
})

describe('withProbeAttempt', () => {
  test('records the attempt timestamp, preserving all other state', () => {
    const state: CandidateState = {
      category: 'first-party-free',
      fingerprint: 'h01234567',
      downStreak: 0,
      lastSeenUtc: iso(DAY_MS),
      url: 'https://api.example-free.ai/v1',
      lastBoundary: 'boundary-unverifiable',
      lastProbe: null,
      models: [],
    }
    const stamped = withProbeAttempt(state, NOW)
    expect(stamped.lastProbeAttemptUtc).toBe(new Date(NOW).toISOString())
    expect(stamped.fingerprint).toBe('h01234567')
    expect(stamped.lastBoundary).toBe('boundary-unverifiable')
    // Pure: the input is untouched.
    expect(state.lastProbeAttemptUtc).toBeUndefined()
  })
})

describe('state layer carries lastProbeAttemptUtc (drop = cadence never advances)', () => {
  const RAW = JSON.stringify({
    _meta: { version: 2, pipeline: 'FID-2026-0915-001' },
    hosts: {
      'api.example-free.ai': {
        category: 'first-party-free',
        fingerprint: 'h01234567',
        downStreak: 0,
        lastSeenUtc: '2026-09-17T12:00:00.000Z',
        url: 'https://api.example-free.ai/v1',
        lastBoundary: 'boundary-unverifiable',
        lastProbe: null,
        models: [],
        history: [],
        lastProbeAttemptUtc: '2026-09-16T12:00:00.000Z',
      },
    },
  })

  test('parseStateFile reads the field; absent reads as undefined', () => {
    const parsed = parseStateFile(RAW)
    expect(parsed.get('api.example-free.ai')?.lastProbeAttemptUtc).toBe(
      '2026-09-16T12:00:00.000Z',
    )
    const without = parseStateFile(
      RAW.replace(/,"lastProbeAttemptUtc":"2026-09-16T12:00:00.000Z"/, ''),
    )
    expect(
      without.get('api.example-free.ai')?.lastProbeAttemptUtc,
    ).toBeUndefined()
  })

  test('diffCandidates re-sight PRESERVES the field (explicit-literal rebuild)', () => {
    const previous = parseStateFile(RAW)
    const card = {
      host: 'api.example-free.ai',
      url: 'https://api.example-free.ai/v1',
      category: 'first-party-free',
      freeModelsEn: ['m1'],
      freeQuotaEn: '',
      status: 'up',
      probe: null,
    }
    const { next } = diffCandidates(previous, [card], NOW)
    expect(next.get('api.example-free.ai')?.lastProbeAttemptUtc).toBe(
      '2026-09-16T12:00:00.000Z',
    )
  })
})
