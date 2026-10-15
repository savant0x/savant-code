/**
 * FID-2026-1005-008 — availability verdict taxonomy (declared gate). The
 * measured failure this pins: a mis-parse of a 200 response hid fully
 * available models for a round. Body shape first, never the error's
 * existence.
 */
import { describe, expect, test } from 'bun:test'

import {
  advertisedModelVisible,
  modelAvailability,
  recordModelAvailability,
} from '../availability-state'
import {
  GATEWAY_FAULT_FROM_FAILURE_REASON,
  classifyAvailabilityObservation,
  isVisibleInAdvertisedLists,
} from '../availability-verdict'

describe('availability verdicts (FID-2026-1005-008)', () => {
  test('the measured 200-parse-fault case: undecodable body is never a verdict', () => {
    const verdict = classifyAvailabilityObservation({
      httpStatus: 200,
      bodyDecoded: false,
      observedAt: 1000,
    })
    expect(verdict).toEqual({ class: 'gateway-fault', kind: 'parse' })
    expect(isVisibleInAdvertisedLists(verdict)).toBe(true) // stays reachable
  })

  test('a decodeable body with no rejection is routable', () => {
    expect(
      classifyAvailabilityObservation({
        httpStatus: 200,
        bodyDecoded: true,
        observedAt: 1,
      }),
    ).toEqual({ class: 'routable', observedAt: 1 })
  })

  test('an explicit provider refusal is a verdict with reason + time', () => {
    const verdict = classifyAvailabilityObservation({
      bodyDecoded: true,
      rejected: { reason: 'declared but not routed' },
      observedAt: 42,
    })
    expect(verdict).toEqual({
      class: 'declared-not-routed',
      reason: 'declared but not routed',
      observedAt: 42,
    })
    expect(isVisibleInAdvertisedLists(verdict)).toBe(false) // the ONLY hide
  })

  test('gateway faults stay reachable: 5xx / 429 / timeout / network', () => {
    for (const [observation, kind] of [
      [{ bodyDecoded: true, httpStatus: 503, observedAt: 1 }, '5xx'],
      [{ bodyDecoded: true, httpStatus: 429, observedAt: 1 }, '429'],
      [{ bodyDecoded: true, transport: 'timeout', observedAt: 1 }, 'timeout'],
      [{ bodyDecoded: true, transport: 'network', observedAt: 1 }, 'network'],
    ] as const) {
      const verdict = classifyAvailabilityObservation(observation)
      expect(verdict).toEqual({ class: 'gateway-fault', kind })
      expect(isVisibleInAdvertisedLists(verdict)).toBe(true)
    }
  })

  test('eligibility gating is its own class, never a rejection', () => {
    for (const kind of ['region', 'account'] as const) {
      const verdict = classifyAvailabilityObservation({
        bodyDecoded: true,
        gated: kind,
        observedAt: 1,
      })
      expect(verdict).toEqual({ class: 'eligibility-gated', kind })
      expect(isVisibleInAdvertisedLists(verdict)).toBe(true)
    }
  })

  test('a later success restores automatically (migration on reprobe)', () => {
    const hidden = classifyAvailabilityObservation({
      bodyDecoded: true,
      rejected: { reason: 'region policy' },
      observedAt: 1,
    })
    expect(isVisibleInAdvertisedLists(hidden)).toBe(false)
    const reprobed = classifyAvailabilityObservation({
      bodyDecoded: true,
      observedAt: 2,
    })
    expect(reprobed.class).toBe('routable')
    expect(isVisibleInAdvertisedLists(reprobed)).toBe(true)
  })

  test('recorded faults retain reachability while an explicit refusal hides until success', () => {
    const provider = 'availability-test-provider'
    const model = 'availability-test-model'
    recordModelAvailability(provider, model, {
      class: 'declared-not-routed',
      reason: 'model_not_found',
      observedAt: 1,
    })
    expect(advertisedModelVisible(provider, model)).toBe(false)
    expect(modelAvailability(provider, model)).toMatchObject({
      reason: 'model_not_found',
    })
    recordModelAvailability(provider, model, {
      class: 'gateway-fault',
      kind: 'parse',
    })
    expect(advertisedModelVisible(provider, model)).toBe(false)
    recordModelAvailability(provider, model, {
      class: 'routable',
      observedAt: 2,
    })
    expect(advertisedModelVisible(provider, model)).toBe(true)
  })

  test('fault kinds mirror the 006 transient reasons 1:1 (no second vocabulary)', () => {
    expect(GATEWAY_FAULT_FROM_FAILURE_REASON).toEqual({
      server: '5xx',
      'rate-limit': '429',
      timeout: 'timeout',
      network: 'network',
    })
  })
})
