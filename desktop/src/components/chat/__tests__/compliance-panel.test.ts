import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  createComplianceRefresh,
  rankCounts,
  trendPoints,
} from '../compliance-data'
import { ComplianceCharts } from '../ComplianceCharts'
import { CompliancePanel } from '../CompliancePanel'

import type { TelemetryAggregates } from '../../../lib/gateway-protocol'
import type { ComplianceState } from '../compliance-data'

const data: TelemetryAggregates = {
  violationsByLaw: { '7': 3, '1': 1 },
  violationsByModel: { 'route/model': 3, '': 1 },
  lawByModel: { '7': { 'route/model': 3 }, '1': { '': 1 } },
  trendSeries: [
    { day: '2026-10-08', count: 0 },
    { day: '2026-10-09', count: 4 },
  ],
  meta: { totalLines: 5, skippedLines: 1, window: 7 },
}

describe('compliance panel', () => {
  test('ranks deterministically and renders bounded zero/one point trends', () => {
    expect(rankCounts({ b: 2, a: 2, c: 3 })).toEqual([
      ['c', 3],
      ['a', 2],
      ['b', 2],
    ])
    expect(trendPoints([])).toBe('')
    expect(trendPoints([{ day: 'today', count: 0 }])).toBe('50,28')
    expect(trendPoints(data.trendSeries)).toBe('0,28 100,4')
  })
  test('charts expose numeric cells, unknown identity, dated trend and parse errors', () => {
    const html = renderToStaticMarkup(createElement(ComplianceCharts, { data }))
    for (const text of [
      'Law 7',
      'route/model',
      'Unattributed',
      '2026-10-09',
      '4 observations',
      'malformed ledger lines skipped',
      'scope="row"',
      'data-intensity="high"',
    ])
      expect(html).toContain(text)
  })
  test('empty and disconnected states never invent events', () => {
    const empty = { ...data, violationsByLaw: {}, trendSeries: [] }
    expect(
      renderToStaticMarkup(createElement(ComplianceCharts, { data: empty })),
    ).toContain('No compliance events')
    expect(
      renderToStaticMarkup(
        createElement(CompliancePanel, {
          api: {
            getTelemetryAggregates: async () => ({
              window: '7d',
              aggregates: data,
            }),
          },
          connected: false,
        }),
      ),
    ).toContain('Connect to load compliance data')
  })
  test('refresh publishes ready, preserves window, contains failures and suppresses duplicates', async () => {
    const states: ComplianceState[] = []
    let calls = 0
    const owner = createComplianceRefresh(
      {
        getTelemetryAggregates: async (window) => {
          calls++
          return { window, aggregates: data }
        },
      },
      '7d',
      (state) => states.push(state),
    )
    await Promise.all([owner.refresh(), owner.refresh()])
    expect(calls).toBe(1)
    expect(states[0]).toEqual({ status: 'ready', aggregates: data })
    const fail = createComplianceRefresh(
      {
        getTelemetryAggregates: async () => {
          throw new Error('sensitive raw error')
        },
      },
      '30d',
      (state) => states.push(state),
    )
    await fail.refresh()
    expect(states[1]).toMatchObject({ status: 'error' })
    expect(JSON.stringify(states)).not.toContain('sensitive raw error')
  })
  test('disposed windows cannot publish late results or start more requests', async () => {
    const states: ComplianceState[] = []
    const deferred = Promise.withResolvers<{
      window: string
      aggregates: TelemetryAggregates
    }>()
    const owner = createComplianceRefresh(
      { getTelemetryAggregates: () => deferred.promise },
      '7d',
      (state) => states.push(state),
    )
    const pending = owner.refresh()
    owner.dispose()
    deferred.resolve({ window: '7d', aggregates: data })
    await pending
    await owner.refresh()
    expect(states).toEqual([])
  })
  test('wrong window replies become errors', async () => {
    const states: ComplianceState[] = []
    await createComplianceRefresh(
      {
        getTelemetryAggregates: async () => ({
          window: 'all',
          aggregates: data,
        }),
      },
      '7d',
      (state) => states.push(state),
    ).refresh()
    expect(states[0]).toMatchObject({ status: 'error' })
  })
})
