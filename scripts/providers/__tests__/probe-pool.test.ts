/**
 * FID-2026-0918-001 — RED-first pins for the bounded-concurrency probe
 * pool. Written BEFORE lib/probe-pool.ts exists; these fail until the
 * implementation lands (RED → GREEN discipline).
 */

import { describe, expect, test } from 'bun:test'

import { type TrackedProvider, runHealthProbePhase } from '../lib/health-probe'
import { PROBE_CONCURRENCY, runWithConcurrency } from '../lib/probe-pool'

import type { lookup } from 'node:dns/promises'

describe('runWithConcurrency (FID-2026-0918-001)', () => {
  test('never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0
    await runWithConcurrency(
      Array.from({ length: 12 }, (_, i) => i),
      3,
      async (n) => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
        return n
      },
    )
    expect(peak).toBeLessThanOrEqual(3)
    expect(peak).toBeGreaterThan(1) // actually overlapped, not serial
  })

  test('delivers every result in input order', async () => {
    const results = await runWithConcurrency(
      Array.from({ length: 10 }, (_, i) => i),
      4,
      async (n) => {
        // Variable latency: later items can finish first.
        await new Promise((r) => setTimeout(r, (10 - n) % 4))
        return n * 2
      },
    )
    expect(results).toEqual(Array.from({ length: 10 }, (_, i) => i * 2))
  })

  test('empty input is a no-op returning an empty array', async () => {
    let calls = 0
    const results = await runWithConcurrency([], 4, async () => {
      calls++
      return 0
    })
    expect(calls).toBe(0)
    expect(results).toEqual([])
  })

  test('limit larger than input runs everything immediately', async () => {
    let inFlight = 0
    let peak = 0
    const results = await runWithConcurrency(
      [1, 2, 3],
      PROBE_CONCURRENCY,
      async (n) => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
        return n
      },
    )
    expect(peak).toBe(3)
    expect(results).toEqual([1, 2, 3])
  })

  test('non-positive limit degrades to serial instead of hanging', async () => {
    let inFlight = 0
    let peak = 0
    const results = await runWithConcurrency([1, 2, 3], 0, async (n) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 2))
      inFlight--
      return n
    })
    expect(peak).toBe(1)
    expect(results).toEqual([1, 2, 3])
  })

  test('worker rejection propagates to the caller', async () => {
    const boom = new Error('probe exploded')
    let calls = 0
    try {
      await runWithConcurrency([1, 2, 3, 4], 2, async (n) => {
        calls++
        // Realistic probe shape: every worker awaits I/O before settling.
        await new Promise((r) => setTimeout(r, 2))
        if (n === 2) throw boom
        return n
      })
      expect.unreachable()
    } catch (err) {
      expect(err).toBe(boom)
    }
    // The rejection lands while other lanes are still mid-flight — the
    // caller is never asked to wait for the whole batch after a failure.
    expect(calls).toBeLessThan(4)
  })

  test('PROBE_CONCURRENCY is the production limit (6)', () => {
    expect(PROBE_CONCURRENCY).toBe(6)
  })
})

describe('runHealthProbePhase pooled path (FID-2026-0918-001)', () => {
  // Network-free: probeEndpoint's fetchImpl and lookupImpl are injected
  // (repo DI convention), so the pool's health branch is exercised without
  // sockets. 4 fake providers × real DNS would otherwise leave the pooled
  // health path with LIVE-evidence-only coverage (unverifiable here).
  const fakeLookup: typeof lookup = (_hostname, _options, callback) =>
    process.nextTick(() =>
      callback(null, [{ address: '93.184.216.34', family: 4 }]),
    ) as unknown as void

  function makeFetch(latch: { inFlight: number; peak: number }): typeof fetch {
    return (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      latch.inFlight++
      latch.peak = Math.max(latch.peak, latch.inFlight)
      await new Promise((r) => setTimeout(r, 2))
      latch.inFlight--
      // Legitimate-provider shape: /models answers 200, the unauthenticated
      // generation POST is refused 401 (boundary-ok → verdict healthy).
      const status = (init?.method ?? 'GET') === 'POST' ? 401 : 200
      return new Response(JSON.stringify({ data: [{ id: 'm1' }] }), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
  }

  const tracked: TrackedProvider[] = [1, 2, 3, 4].map((n) => ({
    id: `prov-${n}`,
    label: `Provider ${n}`,
    baseUrl: `https://prov${n}.example.test/v1`,
    acceptedAt: '2026-09-18T00:00:00.000Z',
  }))

  test('health probes run pooled and produce verdicts for every provider', async () => {
    const latch = { inFlight: 0, peak: 0 }
    const { health, healthProbes } = await runHealthProbePhase({
      tracked,
      doProbe: true,
      fetchImpl: makeFetch(latch),
      lookupImpl: fakeLookup,
    })
    expect(health).toHaveLength(4)
    expect(healthProbes).toHaveLength(4)
    expect(health.every((h) => h.verdict === 'healthy')).toBe(true)
    expect(health.every((h) => h.host.startsWith('prov-'))).toBe(true)
    expect(latch.peak).toBeLessThanOrEqual(PROBE_CONCURRENCY)
  })

  test('doProbe false emits the skip row without probing', async () => {
    let calls = 0
    const { health } = await runHealthProbePhase({
      tracked,
      doProbe: false,
      fetchImpl: (() => {
        calls++
        throw new Error('must not be called')
      }) as unknown as typeof fetch,
      lookupImpl: fakeLookup,
    })
    expect(calls).toBe(0)
    expect(health).toHaveLength(1)
    expect(health[0]?.verdict).toBe('skipped')
  })
})
