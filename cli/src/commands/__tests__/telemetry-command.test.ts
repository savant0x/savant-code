import { parseComplianceLedger } from '@savant-code/common/util/telemetry-aggregate'
import { describe, expect, test } from 'bun:test'

import { COMMAND_REGISTRY } from '../command-registry'
import { parseTelemetryArgs, renderTelemetryView } from '../defs/telemetry'
import { handleTelemetryCommand } from '../telemetry'

import type { ChatMessage } from '../../types/chat'

/**
 * FID-2026-1007-012 FID 4 — the `telemetry` slash group. Pure parse + render
 * pins (the handler is thin I/O over the shared aggregation); one smoke pin
 * proves the empty-ledger message.
 */
const NOW = Date.parse('2026-10-08T12:00:00.000Z')

function fixtureLedger() {
  return parseComplianceLedger(
    [
      JSON.stringify({
        schemaVersion: 1,
        ts: '2026-10-08T10:00:00.000Z',
        sessionId: 's1',
        model: 'glm-5.3-flash',
        provider: 'hcnsec',
        lawId: 7,
        violationClass: 'flagged',
        agentRole: 'forge',
        gateLayer: 'pre-write',
        contextHash: '',
      }),
      JSON.stringify({
        schemaVersion: 1,
        ts: '2026-10-08T11:00:00.000Z',
        sessionId: 's1',
        model: 'kimi-k3',
        provider: 'hcnsec',
        lawId: 3,
        violationClass: 'rejected',
        agentRole: 'forge',
        gateLayer: 'escalation',
        contextHash: '',
      }),
    ].join('\n'),
  )
}

describe('telemetry command (FID-2026-1007-012 FID 4)', () => {
  test('the telemetry command is registered', () => {
    const command = COMMAND_REGISTRY.find(
      (definition) => definition.name === 'telemetry',
    )
    expect(command).toBeDefined()
    expect(
      COMMAND_REGISTRY.filter((definition) => definition.name === 'telemetry'),
    ).toHaveLength(1)
  })

  test('args default to summary over 30d', () => {
    expect(parseTelemetryArgs('')).toEqual({ view: 'summary', windowDays: 30 })
  })

  test('subcommands and windows parse', () => {
    expect(parseTelemetryArgs('laws')).toMatchObject({ view: 'laws' })
    expect(parseTelemetryArgs('models --window 7d')).toMatchObject({
      view: 'models',
      windowDays: 7,
    })
    expect(parseTelemetryArgs('summary --window all')).toMatchObject({
      windowDays: 'all',
    })
  })

  test('unknown tokens produce usage, never a throw', () => {
    expect(parseTelemetryArgs('bogus')).toHaveProperty('usage')
    expect(parseTelemetryArgs('--window forever')).toHaveProperty('usage')
    expect(parseTelemetryArgs('laws models')).toHaveProperty('usage')
    expect(parseTelemetryArgs('summary --window 0d')).toHaveProperty('usage')
    expect(parseTelemetryArgs('summary --window 999999999d')).toHaveProperty(
      'usage',
    )
    expect(
      parseTelemetryArgs('summary --window 7d --window all'),
    ).toHaveProperty('usage')
  })

  test('summary names totals and leaders', () => {
    const text = renderTelemetryView('summary', fixtureLedger(), 30, NOW)
    expect(text).toContain('2 event(s)')
    // Tie (1-1) breaks by ascending law id — a stated rule, not key order.
    expect(text).toContain('Top law: law 3 (1)')
    expect(text).toContain('Top model: glm-5.3-flash (1)')
  })

  test('laws and models views list ranked rows', () => {
    const laws = renderTelemetryView('laws', fixtureLedger(), 30, NOW)
    expect(laws).toContain('- law 7: 1')
    expect(laws).toContain('- law 3: 1')
    const models = renderTelemetryView('models', fixtureLedger(), 30, NOW)
    expect(models).toContain('- glm-5.3-flash: 1')
    expect(models).toContain('- kimi-k3: 1')
  })

  test('an empty ledger states the empty state honestly', () => {
    const text = renderTelemetryView(
      'summary',
      { records: [], skippedLines: 0, totalLines: 0 },
      30,
      NOW,
    )
    expect(text).toContain('No compliance events recorded yet')
  })

  test('the handler reports the empty state when no ledger exists', () => {
    const messages: ChatMessage[] = handleTelemetryCommand('summary')([])
    expect(
      messages.some((message) =>
        JSON.stringify(message).includes('No compliance events recorded yet'),
      ),
    ).toBe(true)
  })

  test('bare and status commands retain remote consent status', () => {
    for (const action of ['', 'status']) {
      expect(JSON.stringify(handleTelemetryCommand(action)([]))).toContain(
        'Remote analytics',
      )
    }
  })
})
