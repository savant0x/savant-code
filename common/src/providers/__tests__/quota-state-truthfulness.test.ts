/**
 * FID-2026-1005-008 — quota-state truthfulness (declared gate). Negative
 * proofs are the point: `unknown` is never `exhausted` and disables
 * nothing; a no-data round can never mint `quota-recovered`; estimates
 * never present as billing facts.
 */
import { describe, expect, test } from 'bun:test'

import { quotaEpisode } from '../provider-quota-policy'
import {
  EVIDENCE_SOURCE_PREFERENCE,
  quotaNoticeKindForTransition,
  resolveQuotaState,
} from '../provider-quota-state'

import type { ProviderQuotaResult } from '../provider-quota'

const ok = (over: Partial<Extract<ProviderQuotaResult, { status: 'ok' }>> = {}): ProviderQuotaResult => ({
  status: 'ok',
  reading: '50 tokens',
  note: '',
  url: 'https://test',
  // Default is a HEALTHY ratio (0.5); low-ratio cases override explicitly.
  amount: 50,
  limit: 100,
  ...over,
})

describe('quota truth states (FID-2026-1005-008)', () => {
  test('source-absent readings are unknown (no source, no fact)', () => {
    for (const detail of ['no quota endpoint declared', 'no key configured', 'no numeric reading at "x"']) {
      expect(resolveQuotaState({ status: 'unavailable', detail })).toEqual({
        state: 'unknown',
        source: 'none',
      })
    }
  })

  test('source-DOWN readings are unavailable — the split the old bucket lost', () => {
    for (const detail of ['timed out', 'request failed', 'HTTP 500', 'quota endpoint origin mismatch']) {
      expect(resolveQuotaState({ status: 'unavailable', detail }).state).toBe('unavailable')
    }
  })

  test('exhausted requires an observed zero or at-limit reading', () => {
    expect(resolveQuotaState(ok({ amount: 0 })).state).toBe('exhausted')
    expect(resolveQuotaState(ok({ amount: 100, limit: 100 })).state).toBe('exhausted')
    expect(resolveQuotaState(ok()).state).toBe('healthy')
    expect(resolveQuotaState(ok({ amount: 5, limit: 100 })).state).toBe('approaching_limit')
    expect(resolveQuotaState(ok({ amount: 5, limit: undefined })).state).toBe('healthy')
    expect(resolveQuotaState(ok({ amount: undefined, limit: undefined })).state).toBe('unknown')
  })

  test('estimates never mint exhausted — only approach or stay unknown', () => {
    // Even an estimated ZERO is not an observed zero.
    expect(resolveQuotaState(ok({ amount: 0 }), 'local-estimate').state).toBe('unknown')
    expect(resolveQuotaState(ok({ amount: 0 }), 'none').state).toBe('unknown')
    expect(resolveQuotaState(ok({ amount: 5, limit: 100 }), 'local-estimate').state).toBe('approaching_limit')
    expect(EVIDENCE_SOURCE_PREFERENCE.at(-1)).toBe('none')
    expect(EVIDENCE_SOURCE_PREFERENCE.at(-2)).toBe('local-estimate')
  })

  test('notification preconditions: exhausted/recovered/low are earned', () => {
    expect(quotaNoticeKindForTransition('healthy', 'exhausted', 'authenticated-usage-api')).toBe('quota-exhausted')
    expect(quotaNoticeKindForTransition('exhausted', 'healthy', 'authenticated-usage-api')).toBe('quota-recovered')
    expect(quotaNoticeKindForTransition('healthy', 'approaching_limit', 'authenticated-usage-api')).toBe('quota-low')
    // Negative proofs: a no-data round mints nothing.
    expect(quotaNoticeKindForTransition('unknown', 'healthy', 'none')).toBeNull()
    expect(quotaNoticeKindForTransition('unavailable', 'healthy', 'none')).toBeNull()
    expect(quotaNoticeKindForTransition('healthy', 'healthy', 'authenticated-usage-api')).toBeNull()
    expect(quotaNoticeKindForTransition('exhausted', 'unknown', 'none')).toBeNull()
    // Estimate-sourced low is not a billing claim.
    expect(quotaNoticeKindForTransition('healthy', 'approaching_limit', 'local-estimate')).toBeNull()
  })

  test('the episode reducer: unknown/unavailable are display-neutral no-ops', () => {
    let episode = quotaEpisode(undefined, ok({ amount: 0 }), 100)
    expect(episode.level).toBe('exhausted')
    // A no-data round never levels anything down and never "recovers".
    episode = quotaEpisode(episode, { status: 'unavailable', detail: 'no quota endpoint declared' }, 100)
    expect(episode.level).toBe('exhausted')
    expect(episode.revision).toBe(1)
    // unknown → exhausted is impossible without a fresh observed zero.
    const fresh = quotaEpisode(undefined, { status: 'unavailable', detail: 'timed out' }, 100)
    expect(fresh.level).toBe('unknown')
    expect(quotaEpisode(fresh, ok({ amount: 7, limit: undefined }), 100).level).toBe('healthy')
  })
})
