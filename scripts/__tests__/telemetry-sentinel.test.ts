/**
 * Regression-sentinel pins (FID-2026-1007-012 FID 6).
 *
 * RED-first: no drift detection existed over compliance profiles. Every pin
 * runs fixture ledgers through the pure detector with an injected clock.
 */
import { describe, expect, test } from 'bun:test'

import { detectDrift } from '../telemetry-sentinel'

const NOW = Date.parse('2026-10-08T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function event(
  model: string,
  lawId: number,
  ts: string,
  sessionId = 's1',
): string {
  return JSON.stringify({
    schemaVersion: 1,
    ts,
    sessionId,
    model,
    provider: 'hcnsec',
    lawId,
    violationClass: 'flagged',
    agentRole: 'forge',
    gateLayer: 'pre-write',
    contextHash: '',
  })
}

function ledgerAt(dayOffset: number, count: number): string[] {
  const ts = new Date(NOW - dayOffset * DAY).toISOString()
  return Array.from({ length: count }, (_, index) =>
    event('glm-5.3-flash', 7, ts, `s${index}`),
  )
}

describe('regression sentinel (FID-2026-1007-012 FID 6)', () => {
  test('injected drift produces a finding', () => {
    const lines = [
      ...ledgerAt(10, 6),
      ...ledgerAt(9, 6),
      ...ledgerAt(2, 12),
      ...ledgerAt(1, 12),
    ]
    const run = detectDrift(lines.join('\n'), { now: NOW })
    expect(run.findings).toHaveLength(1)
    expect(run.findings[0]).toMatchObject({
      model: 'glm-5.3-flash',
      law: '7',
      priorCount: 12,
      currentCount: 24,
    })
    expect(run.findings[0]!.ratio).toBeGreaterThanOrEqual(2)
  })

  test('stable data produces no findings', () => {
    const lines = [...ledgerAt(10, 6), ...ledgerAt(2, 6)]
    const run = detectDrift(lines.join('\n'), { now: NOW })
    expect(run.findings).toEqual([])
    expect(run.windowDays).toBe(7)
  })

  test('small-sample doubling is noise, not drift', () => {
    const lines = [...ledgerAt(10, 2), ...ledgerAt(2, 4)]
    const run = detectDrift(lines.join('\n'), { now: NOW })
    expect(run.findings).toEqual([])
  })

  test('an empty ledger is a clean run', () => {
    const run = detectDrift('', { now: NOW })
    expect(run.findings).toEqual([])
    expect(run.ts).toBe(new Date(NOW).toISOString())
  })

  test('future events cannot create drift in the current window', () => {
    const lines = [...ledgerAt(10, 6), ...ledgerAt(-1, 12)]
    expect(detectDrift(lines.join('\n'), { now: NOW }).findings).toEqual([])
  })
})
