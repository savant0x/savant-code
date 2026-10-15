/**
 * FID-2026-0915-002 (split 5) — W1 ring/uptime + state-v2 pins, moved
 * verbatim from intelligence-layer.test.ts (the `appendHistory (W1 ring
 * buffer)`, `uptimeFor (W1 report cell)`, and
 * `state v2 (_meta.version 2) + zero-blip migration` describes).
 */
import { describe, expect, test } from 'bun:test'

import { state, T0 } from './helpers'
import {
  appendHistory,
  HISTORY_CAP,
  parseStateFile,
  serializeStateFile,
  uptimeFor,
  type CandidateState,
  type HistorySample,
} from '../../../common/src/providers/discovery-state'

describe('appendHistory (W1 ring buffer)', () => {
  test('appends one sample and returns a NEW map (purity)', () => {
    const before = new Map([['h', state()]])
    const sample: HistorySample = {
      d: '2026-09-15',
      up: true,
      ms: 320,
      b: 'boundary-ok',
    }
    const after = appendHistory(before, 'h', sample)
    expect(after).not.toBe(before)
    expect(before.get('h')?.history).toEqual([])
    expect(after.get('h')?.history).toEqual([sample])
  })

  test(`caps at ${HISTORY_CAP} samples, dropping the OLDEST`, () => {
    let m = new Map([['h', state()]])
    for (let i = 0; i < HISTORY_CAP + 5; i++) {
      m = appendHistory(m, 'h', {
        d: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
        up: true,
        ms: 100 + i,
        b: 'boundary-ok',
      })
    }
    const history = m.get('h')?.history ?? []
    expect(history.length).toBe(HISTORY_CAP)
    expect(history[0]?.ms).toBe(100 + 5)
  })

  test('same-day re-run replaces the sample (idempotent per date)', () => {
    let m = new Map([['h', state()]])
    m = appendHistory(m, 'h', { d: '2026-09-15', up: true, ms: 320, b: 'x' })
    m = appendHistory(m, 'h', { d: '2026-09-15', up: true, ms: 999, b: 'x' })
    const history = m.get('h')?.history ?? []
    expect(history.length).toBe(1)
    expect(history[0]?.ms).toBe(999)
  })

  test('missing host key is a no-op (no phantom hosts)', () => {
    const before = new Map([['h', state()]])
    const after = appendHistory(before, 'ghost', {
      d: '2026-09-15',
      up: true,
      ms: 1,
      b: 'x',
    })
    expect(after.size).toBe(1)
  })
})

describe('uptimeFor (W1 report cell)', () => {
  test('percent up + average latency of non-null samples', () => {
    const history: HistorySample[] = [
      { d: '1', up: true, ms: 100, b: 'boundary-ok' },
      { d: '2', up: true, ms: 300, b: 'boundary-ok' },
      { d: '3', up: false, ms: null, b: 'down' },
    ]
    expect(uptimeFor(history)).toEqual({ pct: 67, avgMs: 200 })
  })

  test('null latency samples are excluded from the average', () => {
    const history: HistorySample[] = [
      { d: '1', up: true, ms: null, b: 'boundary-unverifiable' },
      { d: '2', up: true, ms: 300, b: 'boundary-ok' },
    ]
    expect(uptimeFor(history)).toEqual({ pct: 100, avgMs: 300 })
  })

  test('empty history renders null (column shows —)', () => {
    expect(uptimeFor([])).toBeNull()
  })
})

describe('state v2 (_meta.version 2) + zero-blip migration', () => {
  test('serialize writes version 2 with firstSeenUtc and history', () => {
    const json = serializeStateFile(new Map([['h', state()]]))
    const parsed = JSON.parse(json) as {
      _meta: { version: number }
      hosts: Record<string, CandidateState>
    }
    expect(parsed._meta.version).toBe(2)
    expect(parsed.hosts['h']?.firstSeenUtc).toBe(new Date(T0).toISOString())
    expect(parsed.hosts['h']?.history).toEqual([])
  })

  test('v1 file migrates: synthesized 1-entry history from lastProbe, models kept', () => {
    const v1 = JSON.stringify({
      _meta: { version: 1, pipeline: 'FID-2026-0914-003' },
      hosts: {
        h: {
          category: 'first-party-free',
          fingerprint: 'habcdef01',
          downStreak: 0,
          lastSeenUtc: new Date(T0).toISOString(),
          url: 'https://api.example-free.ai',
          lastBoundary: 'boundary-ok',
          lastProbe: {
            reachable: true,
            modelsCount: 2,
            boundary: 'boundary-ok',
            latencyMs: 320,
          },
        },
      },
    })
    const parsed = parseStateFile(v1)
    const h = parsed.get('h')
    expect(h).toBeDefined()
    expect(h?.models).toEqual([])
    expect(h?.history?.length).toBe(1)
    expect(h?.history?.[0]).toEqual({
      d: new Date(T0).toISOString().slice(0, 10),
      up: true,
      ms: 320,
      b: 'boundary-ok',
    })
  })

  test('legacy bare-map files still parse (shape tolerance preserved)', () => {
    const parsed = parseStateFile(
      JSON.stringify({
        h: {
          fingerprint: 'habcdef01',
          lastSeenUtc: new Date(T0).toISOString(),
          url: 'https://h',
        },
      }),
    )
    expect(parsed.get('h')?.url).toBe('https://h')
  })
})
