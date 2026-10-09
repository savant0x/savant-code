import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { startGateway } from '../gateway'
import {
  defaultLoadTelemetryAggregates,
  handleTelemetryAggregates,
} from '../gateway/telemetry-rpc'
import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import { openSocket, request, TEST_TOKEN } from './gateway-test-harness'

import type { ComplianceAggregates } from '@savant-code/common/util/telemetry-aggregate'

/**
 * FID-2026-1007-012 FID 5 — the telemetry_aggregates gateway method. Pure
 * handler pins over a fixture loader, plus the live path: the real default
 * loader against a seeded compliance.jsonl (no mocks on the data path).
 */
const tempRoots: string[] = []
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function call(
  params: unknown,
  load: (windowDays: number | 'all') => ComplianceAggregates,
): unknown[] {
  const frames: unknown[] = []
  handleTelemetryAggregates(
    (data: string) => {
      frames.push(JSON.parse(data))
    },
    7,
    params,
    load,
    undefined,
  )
  return frames
}

const fixtureAggregates: ComplianceAggregates = {
  violationsByLaw: { '7': 4 },
  violationsByModel: {},
  lawByModel: {},
  trendSeries: [],
  meta: { totalLines: 4, skippedLines: 0, window: 30 as const },
}

describe('telemetry_aggregates (FID-2026-1007-012 FID 5)', () => {
  test('live transport denies telemetry before hello and after a bad token', async () => {
    let reads = 0
    const gateway = await startGateway({
      token: TEST_TOKEN,
      port: 0,
      allowedOrigins: ['tauri://localhost'],
      onReady: () => {},
      providerMonitoring: false,
      runPrompt: async () => {
        throw new Error('not used')
      },
      loadTelemetryAggregates: () => {
        reads++
        return fixtureAggregates
      },
    })
    const socket = await openSocket(gateway.port)
    try {
      expect(
        await request(socket, 'telemetry_aggregates', { window: 'all' }),
      ).toMatchObject({ error: { code: -32600 } })
      expect(reads).toBe(0)
      expect(
        await request(
          socket,
          'hello',
          { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: 'wrong' },
          2,
        ),
      ).toMatchObject({ error: { code: -32001 } })
      expect(
        await request(socket, 'telemetry_aggregates', { window: 'all' }, 3),
      ).toMatchObject({ error: { code: -32001 } })
      expect(reads).toBe(0)
      const authorized = await openSocket(gateway.port)
      try {
        expect(
          await request(
            authorized,
            'hello',
            { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
            4,
          ),
        ).toHaveProperty('result')
        expect(
          await request(
            authorized,
            'telemetry_aggregates',
            { window: 'all' },
            5,
          ),
        ).toHaveProperty('result.aggregates')
        expect(reads).toBe(1)
      } finally {
        authorized.close()
      }
    } finally {
      socket.close()
      await gateway.stop()
    }
  })

  test('serves aggregates for the default window', () => {
    const frames = call({}, () => fixtureAggregates)
    expect(frames).toHaveLength(1)
    const body = (frames[0] as { result: unknown }).result as {
      window: string
      aggregates: typeof fixtureAggregates
    }
    expect(body.window).toBe('30d')
    expect(body.aggregates.violationsByLaw).toEqual({ '7': 4 })
  })

  test('an invalid window fails invalidRequest', () => {
    const frames = call({ window: 'fortnight' }, () => fixtureAggregates)
    const body = frames[0] as { error: { code: number } }
    expect(body.error).toBeDefined()
  })

  test('rejects malformed params and unsupported windows before reading', () => {
    for (const params of [
      null,
      [],
      true,
      '7d',
      { window: null },
      { window: 7 },
      { window: '0d' },
      { window: '999d' },
      { window: '-7d' },
    ]) {
      let calls = 0
      const frames = call(params, () => {
        calls++
        return fixtureAggregates
      })
      expect(frames[0]).toMatchObject({ error: { code: -32600 } })
      expect(calls).toBe(0)
    }
  })

  test('accepts each documented window and contains loader failure', () => {
    for (const [window, days] of [
      ['7d', 7],
      ['30d', 30],
      ['all', 'all'],
    ] as const) {
      const frames = call({ window }, (received) => {
        expect(received).toBe(days)
        return fixtureAggregates
      })
      expect(frames[0]).toMatchObject({ result: { window } })
    }
    expect(
      call({}, () => {
        throw new Error('fixture I/O failure')
      })[0],
    ).toMatchObject({ error: { code: -32603 } })
  })

  test('live data: the default loader aggregates a seeded ledger', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'telemetry-e2e-'))
    tempRoots.push(root)
    const dir = path.join(root, 'dev', 'telemetry')
    mkdirSync(dir, { recursive: true })
    const lines = Array.from({ length: 6 }, (_, index) =>
      JSON.stringify({
        schemaVersion: 1,
        ts: '2026-10-08T10:00:00.000Z',
        sessionId: `s${index}`,
        model: 'glm-5.3-flash',
        provider: 'hcnsec',
        lawId: 7,
        violationClass: 'flagged',
        agentRole: 'forge',
        gateLayer: 'pre-write',
        contextHash: '',
      }),
    )
    writeFileSync(path.join(dir, 'compliance.jsonl'), `${lines.join('\n')}\n`)
    const frames: unknown[] = []
    handleTelemetryAggregates(
      (data: string) => {
        frames.push(JSON.parse(data))
      },
      9,
      { window: 'all' },
      (windowDays: number | 'all') =>
        defaultLoadTelemetryAggregates(windowDays, root),
      undefined,
    )
    const body = (frames[0] as { result: unknown }).result as {
      window: string
      aggregates: { violationsByLaw: Record<string, number> }
    }
    expect(body.window).toBe('all')
    expect(body.aggregates.violationsByLaw).toEqual({ '7': 6 })
  })
})
