import { beforeEach, describe, expect, test } from 'bun:test'

import {
  __resetReferralCacheForTest,
  getCachedReferral,
  rememberReferral,
} from '../savant-free-referral-cache'

import type { SavantFreeSession } from '../../types/savant-free-session'
import type { SavantFreeReferralInfo } from '@savant-code/common/types/savant-free-session'

const referral: SavantFreeReferralInfo = {
  code: 'ABC123',
  referrerName: null,
  qualifiedCount: 2,
  weeklySessionsRemaining: 1,
  resetAt: '2026-07-01T00:00:00.000Z',
  githubLinked: true,
}

const landingWithReferral = {
  status: 'none',
  accessTier: 'full',
  referral,
} as unknown as SavantFreeSession

const activeWithoutReferral = {
  status: 'active',
  accessTier: 'full',
  model: 'minimax/minimax-m3',
  instanceId: 'i-1',
} as unknown as SavantFreeSession

describe('savant-free referral cache', () => {
  beforeEach(() => {
    __resetReferralCacheForTest()
  })

  test('starts empty', () => {
    expect(getCachedReferral()).toBeUndefined()
  })

  test('remembers a referral block from a landing response', () => {
    rememberReferral(landingWithReferral)
    expect(getCachedReferral()).toEqual(referral)
  })

  test('keeps the last referral across a join → active round-trip', () => {
    // Simulates: land on picker (referral present) → join a model (server drops
    // referral from queued/active payloads). The cache must survive so
    // returning to the picker can still render the GLM banner.
    rememberReferral(landingWithReferral)
    rememberReferral(activeWithoutReferral)
    expect(getCachedReferral()).toEqual(referral)
  })

  test('ignores responses without a referral block', () => {
    rememberReferral(activeWithoutReferral)
    expect(getCachedReferral()).toBeUndefined()
  })

  test('ignores null sessions', () => {
    rememberReferral(landingWithReferral)
    rememberReferral(null)
    expect(getCachedReferral()).toEqual(referral)
  })
})
