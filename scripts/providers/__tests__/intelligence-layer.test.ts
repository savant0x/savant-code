/**
 * FID-2026-0915-001 — intelligence-layer pins (RED-first).
 *
 * Pure contracts of the intelligence workstreams: W2 family normalization +
 * model-first index, W3 churn + firstSeen, W4 nudge threshold, W5 fallback
 * hint selection. Fixtures are synthetic — no live network.
 *
 * FID-2026-0915-002 (split 5): the W1 ring/uptime + state-v2 describes
 * moved to ring-buffer.test.ts; the shared `state()` fixture lives in
 * helpers.ts.
 */
import { describe, expect, test } from 'bun:test'

import { DAY, state, T0 } from './helpers'
import { nudgeLine } from '../../../common/src/providers/discovery-context'
import {
  buildModelIndex,
  churnSummary,
  familyToken,
  fallbackHint,
  type CandidateState,
} from '../../../common/src/providers/discovery-state'

describe('familyToken (W2 normalization — the load-bearing join key)', () => {
  test('vendor-prefixed ids, feed prose, and bare ids all join', () => {
    // Same family from three different surfaces:
    expect(familyToken('meta/llama-3.3-70b-instruct')).toBe('llama')
    expect(familyToken('llama-3.3-70b')).toBe('llama')
    expect(familyToken('Llama 3.1/3.3 family')).toBe('llama')
    expect(familyToken('deepseek-ai/deepseek-v4-pro')).toBe('deepseek')
    expect(familyToken('DeepSeek-R1')).toBe('deepseek')
    expect(familyToken('qwen/qwen3-coder:free')).toBe('qwen')
    expect(familyToken('qwen3-coder:free')).toBe('qwen')
    expect(familyToken('Qwen family (most stable)')).toBe('qwen')
    expect(familyToken('GLM-4.7-Flash')).toBe('glm')
    expect(familyToken('z-ai/glm-4.5-air (:free)')).toBe('glm')
    expect(familyToken('kimi-k2.6')).toBe('kimi')
    expect(familyToken('moonshotai/kimi-k2.6')).toBe('kimi')
  })

  test('degenerate inputs produce an empty token (never indexed)', () => {
    expect(familyToken('')).toBe('')
    expect(familyToken('123')).toBe('')
    expect(familyToken('///')).toBe('')
  })
})

describe('buildModelIndex (W2 model-first index)', () => {
  test('groups by family, keeps readiness fields, drops unknown families', () => {
    const index = buildModelIndex([
      {
        host: 'a.free',
        boundary: 'boundary-ok',
        latencyMs: 100,
        models: ['llama-3.3-70b'],
      },
      {
        host: 'b.free',
        boundary: 'boundary-ok',
        latencyMs: 50,
        models: ['meta/llama-3.3-70b-instruct', 'qwen3-coder:free'],
      },
      {
        host: 'c.free',
        boundary: 'boundary-unverifiable',
        latencyMs: 900,
        models: ['Llama family'],
      },
      { host: 'd.free', boundary: 'boundary-ok', latencyMs: 10, models: [] },
    ])
    const llama = index.get('llama') ?? []
    expect(llama.map((e) => e.host)).toEqual(['b.free', 'a.free', 'c.free'])
    expect(llama[0]).toEqual({
      host: 'b.free',
      boundary: 'boundary-ok',
      latencyMs: 50,
    })
    expect(index.has('qwen')).toBe(true)
    // d.free has no models → contributes nothing.
    expect(index.size).toBe(2)
  })
})

describe('fallbackHint (W5 selection contract)', () => {
  const index = buildModelIndex([
    {
      host: 'failing.host',
      boundary: 'boundary-ok',
      latencyMs: 400,
      models: ['qwen3-coder:free'],
    },
    {
      host: 'fast.host',
      boundary: 'boundary-ok',
      latencyMs: 100,
      models: ['qwen3-coder:free'],
    },
    {
      host: 'slow.host',
      boundary: 'boundary-ok',
      latencyMs: 900,
      models: ['Qwen family'],
    },
    {
      host: 'relay.host',
      boundary: 'open-relay-reject',
      latencyMs: 10,
      models: ['qwen3-coder:free'],
    },
  ])

  test('names up to 2 boundary-ok hosts, fastest first, never the failing host', () => {
    const hint = fallbackHint('qwen/qwen3-coder:free', index, {
      failingHost: 'failing.host',
    })
    expect(hint).toContain('fast.host')
    expect(hint).toContain('slow.host')
    expect(hint).not.toContain('relay.host')
    expect(hint).not.toContain('failing.host')
  })

  test('empty string on no index / no family / no eligible hosts', () => {
    expect(fallbackHint('qwen3-coder:free', new Map())).toBe('')
    expect(
      fallbackHint('gpt-oss-120b', index, { failingHost: 'failing.host' }),
    ).toBe('')
    expect(
      fallbackHint('qwen3-coder:free', index, {
        failingHost: 'failing.host',
        eligible: (h) => h === 'relay.host',
      }),
    ).toBe('')
  })
})

describe('churnSummary (W3)', () => {
  test('7-day window counts + median lifespan of lapsed hosts', () => {
    const m = new Map<string, CandidateState>([
      [
        'fresh.host',
        state({ firstSeenUtc: new Date(T0 - 2 * DAY).toISOString() }),
      ],
      [
        'old.host',
        state({ firstSeenUtc: new Date(T0 - 30 * DAY).toISOString() }),
      ],
      // Lapsed records live under the lapsed: prefix (72h rule).
      [
        'lapsed:dead.host',
        state({
          firstSeenUtc: new Date(T0 - 10 * DAY).toISOString(),
          lastSeenUtc: new Date(T0 - 4 * DAY).toISOString(),
        }),
      ],
      [
        'lapsed:older.host',
        state({
          firstSeenUtc: new Date(T0 - 20 * DAY).toISOString(),
          lastSeenUtc: new Date(T0 - 2 * DAY).toISOString(),
        }),
      ],
    ])
    const churn = churnSummary(m, T0)
    expect(churn.newLast7Days).toEqual(['fresh.host'])
    expect(churn.lapsedHosts.sort()).toEqual(['dead.host', 'older.host'])
    // Lifespans: 6d and 18d → median 12.
    expect(churn.medianLifespanDays).toBe(12)
  })

  test('no lapsed hosts → null median', () => {
    const churn = churnSummary(new Map([['h', state()]]), T0)
    expect(churn.medianLifespanDays).toBeNull()
    expect(churn.lapsedHosts).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// W4 — nudge threshold (MQ2: <½ latency, degraded tracked provider, ≥1 model)
// ---------------------------------------------------------------------------

describe('nudgeLine (W4 threshold)', () => {
  const candidates = [
    {
      host: 'fast.candidate',
      boundary: 'boundary-ok',
      latencyMs: 200,
      modelsCount: 3,
    },
    {
      host: 'slower.candidate',
      boundary: 'boundary-ok',
      latencyMs: 450,
      modelsCount: 2,
    },
    {
      host: 'relay.candidate',
      boundary: 'open-relay-reject',
      latencyMs: 10,
      modelsCount: 9,
    },
    {
      host: 'no-models.candidate',
      boundary: 'boundary-ok',
      latencyMs: 100,
      modelsCount: 0,
    },
  ]

  test('degraded provider + candidate at <½ latency → one capped line', () => {
    const line = nudgeLine({
      degradedProvider: {
        host: 'my.provider',
        latencyMs: 900,
        verdict: 'degraded',
      },
      candidates,
    })
    expect(line).toContain('fast.candidate')
    expect(line).not.toContain('slower.candidate')
    expect(line).not.toContain('relay.candidate')
    expect(line.split('\n').length).toBe(1)
  })

  test('healthy provider → never nudges', () => {
    expect(
      nudgeLine({
        degradedProvider: {
          host: 'my.provider',
          latencyMs: 900,
          verdict: 'healthy',
        },
        candidates,
      }),
    ).toBeNull()
  })

  test('no candidate clears the bar (latency or model gate) → null', () => {
    // Half of 300 = 150: fast.candidate (200) NOT < 150; no-models.candidate
    // (100) clears latency but has 0 models.
    expect(
      nudgeLine({
        degradedProvider: { host: 'x', latencyMs: 300, verdict: 'down' },
        candidates,
      }),
    ).toBeNull()
    // Exactly half is NOT strictly below (fast.candidate 200 vs 400/2).
    expect(
      nudgeLine({
        degradedProvider: { host: 'x', latencyMs: 400, verdict: 'down' },
        candidates: [candidates[0]!],
      }),
    ).toBeNull()
    // Only fast candidates have no models.
    expect(
      nudgeLine({
        degradedProvider: { host: 'x', latencyMs: 900, verdict: 'down' },
        candidates: [candidates[3]!],
      }),
    ).toBeNull()
  })

  test('missing numbers → null (never nudges on incomplete data)', () => {
    expect(
      nudgeLine({
        degradedProvider: { host: 'x', latencyMs: null, verdict: 'down' },
        candidates,
      }),
    ).toBeNull()
    expect(nudgeLine({ degradedProvider: null, candidates })).toBeNull()
  })
})
