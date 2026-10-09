import { describe, expect, test } from 'bun:test'

import {
  COMPLIANCE_EVENT_SCHEMA_VERSION,
  complianceEventSchema,
} from '../telemetry'

/**
 * FID-2026-1007-012 FID 1: the `ComplianceEvent` schema. One record per
 * enforced-law observation; metadata only, never message content. Unknown
 * keys strip (drift-forward) so additive-nullable evolution never breaks
 * stored history.
 */
const validEvent = {
  schemaVersion: COMPLIANCE_EVENT_SCHEMA_VERSION,
  ts: '2026-10-08T20:00:00.000Z',
  sessionId: 'session-1',
  model: 'glm-5.3-flash',
  provider: 'hcnsec',
  lawId: 7,
  violationClass: 'flagged',
  agentRole: 'forge',
  gateLayer: 'pre-write',
  contextHash: '',
}

describe('complianceEventSchema (FID-2026-1007-012 FID 1)', () => {
  test('parses a full event', () => {
    const parsed = complianceEventSchema.parse(validEvent)
    expect(parsed.lawId).toBe(7)
    expect(parsed.violationClass).toBe('flagged')
    expect(parsed.gateLayer).toBe('pre-write')
  })

  test('rejects an unknown violation class', () => {
    expect(() =>
      complianceEventSchema.parse({ ...validEvent, violationClass: 'vapors' }),
    ).toThrow()
  })

  test('rejects an unknown gate layer', () => {
    expect(() =>
      complianceEventSchema.parse({ ...validEvent, gateLayer: 'vibes' }),
    ).toThrow()
  })

  test('rejects a missing law id', () => {
    const { lawId: _dropped, ...rest } = validEvent
    expect(() => complianceEventSchema.parse(rest)).toThrow()
  })

  test('strips unknown keys (drift-forward: future fields never break history)', () => {
    const parsed = complianceEventSchema.parse({
      ...validEvent,
      futureField: 'from-a-newer-producer',
    })
    expect(parsed).not.toHaveProperty('futureField')
  })

  test('accepts every violation class and gate layer', () => {
    for (const violationClass of [
      'rejected',
      'corrected',
      'flagged',
    ] as const) {
      for (const gateLayer of [
        'pre-write',
        'escalation',
        'turn-end',
        'receipt',
      ] as const) {
        const parsed = complianceEventSchema.parse({
          ...validEvent,
          violationClass,
          gateLayer,
        })
        expect(parsed.violationClass).toBe(violationClass)
        expect(parsed.gateLayer).toBe(gateLayer)
      }
    }
  })
})
