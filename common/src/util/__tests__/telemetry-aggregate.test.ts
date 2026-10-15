/**
 * Compliance aggregation pins (FID-2026-1007-012 FID 3).
 *
 * RED-first: no aggregation existed over the compliance ledger — raw events
 * with no profiles. Every pin runs fixture ledgers through the pure
 * functions with an injected clock, so no live ledger state is needed.
 */
import { describe, expect, test } from 'bun:test'

import {
  aggregateCompliance,
  parseComplianceLedger,
  purgeComplianceEvents,
} from '../telemetry-aggregate'

const NOW = Date.parse('2026-10-08T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function event(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    ts: '2026-10-08T10:00:00.000Z',
    sessionId: 'session-1',
    model: 'glm-5.3-flash',
    provider: 'hcnsec',
    lawId: 7,
    violationClass: 'flagged',
    agentRole: 'forge',
    gateLayer: 'pre-write',
    contextHash: '',
    ...overrides,
  })
}

describe('compliance aggregation (FID-2026-1007-012 FID 3)', () => {
  test('aggregates exact counts, matrix and meta', () => {
    const ledger = parseComplianceLedger(
      [
        event(),
        event({
          lawId: 3,
          violationClass: 'rejected',
          gateLayer: 'escalation',
        }),
        event({ model: 'kimi-k3', lawId: 3 }),
        'not json{',
        event({ lawId: 'seven' }),
      ].join('\n'),
    )
    expect(ledger.totalLines).toBe(5)
    expect(ledger.skippedLines).toBe(2)
    const aggregates = aggregateCompliance(ledger, {
      windowDays: 'all',
      now: NOW,
    })
    expect(aggregates.violationsByLaw).toEqual({ '7': 1, '3': 2 })
    expect(aggregates.violationsByModel).toEqual({
      'glm-5.3-flash': 2,
      'kimi-k3': 1,
    })
    expect(aggregates.lawByModel).toEqual({
      '7': { 'glm-5.3-flash': 1 },
      '3': { 'glm-5.3-flash': 1, 'kimi-k3': 1 },
    })
    expect(aggregates.meta).toMatchObject({
      totalLines: 5,
      skippedLines: 2,
      window: 'all',
    })
  })

  test('windows exclude older records', () => {
    const oldTs = new Date(NOW - 10 * DAY).toISOString()
    const ledger = parseComplianceLedger(
      [event(), event({ ts: oldTs }), event({ ts: oldTs })].join('\n'),
    )
    const seven = aggregateCompliance(ledger, { windowDays: 7, now: NOW })
    expect(seven.violationsByLaw).toEqual({ '7': 1 })
    const all = aggregateCompliance(ledger, { windowDays: 'all', now: NOW })
    expect(all.violationsByLaw).toEqual({ '7': 3 })
  })

  test('model keys remain plain data even when they name prototype properties', () => {
    const ledger = parseComplianceLedger(
      ['__proto__', 'constructor', 'toString']
        .map((model) => event({ model }))
        .join('\n'),
    )
    const data = aggregateCompliance(ledger, { windowDays: 7, now: NOW })
    for (const model of ['__proto__', 'constructor', 'toString']) {
      expect(data.violationsByModel[model]).toBe(1)
      expect(data.lawByModel['7'][model]).toBe(1)
      expect(Object.hasOwn(data.violationsByModel, model)).toBe(true)
    }
    expect(Object.getPrototypeOf(data.violationsByModel)).toBe(Object.prototype)
  })

  test('rolling windows exclude future events', () => {
    const ledger = parseComplianceLedger(
      [event(), event({ ts: new Date(NOW + DAY).toISOString() })].join('\n'),
    )
    expect(
      aggregateCompliance(ledger, { windowDays: 7, now: NOW }).violationsByLaw,
    ).toEqual({ '7': 1 })
  })

  test('trend series is zero-filled and ascending', () => {
    const twoDaysAgo = new Date(NOW - 2 * DAY).toISOString()
    const ledger = parseComplianceLedger(
      [event(), event({ ts: twoDaysAgo })].join('\n'),
    )
    const aggregates = aggregateCompliance(ledger, {
      windowDays: 7,
      now: NOW,
    })
    const series = aggregates.trendSeries
    expect(series.length).toBeGreaterThan(0)
    const days = series.map((point) => point.day)
    expect([...days].sort()).toEqual(days)
    expect(series[series.length - 1]).toMatchObject({
      day: '2026-10-08',
      count: 1,
    })
    expect(series.find((point) => point.day === '2026-10-06')).toMatchObject({
      count: 1,
    })
    expect(series.find((point) => point.day === '2026-10-07')).toMatchObject({
      count: 0,
    })
  })

  test('an empty ledger aggregates to zeros', () => {
    const aggregates = aggregateCompliance(parseComplianceLedger(''), {
      windowDays: 'all',
      now: NOW,
    })
    expect(aggregates.violationsByLaw).toEqual({})
    expect(aggregates.trendSeries).toEqual([])
    expect(aggregates.meta).toMatchObject({ totalLines: 0, skippedLines: 0 })
  })

  test('purge keeps the retention window', () => {
    const oldTs = new Date(NOW - 100 * DAY).toISOString()
    const ledger = parseComplianceLedger(
      [event(), event({ ts: oldTs })].join('\n'),
    )
    const kept = purgeComplianceEvents(ledger.records, {
      windowDays: 90,
      now: NOW,
    })
    expect(kept).toHaveLength(1)
  })

  test('purge drops unparseable timestamps', () => {
    const ledger = parseComplianceLedger(
      [event(), event({ ts: 'whenever' })].join('\n'),
    )
    // Schema-plain strings parse; the purge window still excludes-undated.
    const kept = purgeComplianceEvents(ledger.records, {
      windowDays: 90,
      now: NOW,
    })
    expect(kept).toHaveLength(1)
  })
})
