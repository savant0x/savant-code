import { describe, expect, test } from 'bun:test'

import { buildTriggerDirective, deliverTrigger } from '../inject'
import { type TriggerDelivery } from '../receiver'

function delivery(overrides: Partial<TriggerDelivery> = {}): TriggerDelivery {
  return {
    triggerId: 'trg_test',
    eventId: 'evt_1',
    nonce: 'n-1',
    summary: 'PR #42 merged',
    fields: { repo: 'savant0x/savant-code', pr: 42 },
    receivedAt: '2026-09-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('trigger injection bridge', () => {
  test('directive is the fixed template: name + single-line JSON payload data', () => {
    const directive = buildTriggerDirective(
      delivery({ summary: 'line1\nline2' }),
      'github-ci',
    )
    expect(directive.startsWith('[SYSTEM TRIGGER: webhook github-ci]')).toBe(
      true,
    )
    // Payload travels as JSON DATA (newlines escaped) — never free prose
    // concatenation, so the directive is always a single line and payload
    // content can never masquerade as prompt structure.
    expect(directive.split('\n')).toHaveLength(1)
    expect(directive).toContain('"summary":"line1\\nline2"')
    expect(directive).toContain('"evt_1"')
  })

  test('happy path: drive called once with the directive', async () => {
    const driven: string[] = []
    const outcome = await deliverTrigger({
      delivery: delivery(),
      triggerName: 'github-ci',
      drive: async (prompt) => {
        driven.push(prompt)
        return { accepted: true }
      },
    })
    expect(outcome).toEqual({ ok: true, duplicate: false })
    expect(driven).toHaveLength(1)
    expect(driven[0]).toContain('[SYSTEM TRIGGER: webhook github-ci]')
  })

  test('busy session (drive reports not-accepted) → 409 outcome', async () => {
    const driven: string[] = []
    const outcome = await deliverTrigger({
      delivery: delivery(),
      triggerName: 'github-ci',
      drive: async (prompt) => {
        driven.push(prompt)
        return {
          accepted: false,
          reason: 'Session busy: a run is already in flight',
        }
      },
    })
    expect(outcome).toEqual({
      ok: false,
      status: 409,
      reason: 'Session busy: a run is already in flight',
    })
    // The drive was attempted (no TOCTOU pre-check); the RUN was not
    // accepted — the gateway guard is the single source of truth.
    expect(driven).toHaveLength(1)
  })

  test('idempotency key is (triggerId, eventId): duplicate event dropped pre-drive\n(nonce is the REPLAY layer concern — retries regenerate nonces, per the\nLoop 2 amendment in FID-2026-0824-005)', async () => {
    const driven: string[] = []
    const seen = new Set<string>()
    const deliver = (d: TriggerDelivery) =>
      deliverTrigger({
        delivery: d,
        triggerName: 'github-ci',
        drive: async (prompt) => {
          driven.push(prompt)
          return { accepted: true }
        },
        seenKeys: seen,
      })

    const first = await deliver(delivery())
    const retry = await deliver(delivery({ nonce: 'n-retry' })) // same event, new attempt
    const fresh = await deliver(delivery({ eventId: 'evt_2' }))
    expect(first).toEqual({ ok: true, duplicate: false })
    expect(retry).toEqual({ ok: true, duplicate: true })
    expect(fresh).toEqual({ ok: true, duplicate: false })
    expect(driven).toHaveLength(2)
  })
})
