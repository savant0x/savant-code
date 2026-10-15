// FID-2026-0819-005 Loop 229: rate-limit suites, moved verbatim from
// receiver.test.ts (parent over the 300-line ceiling). Harness (freshStore,
// startWith, probe, post, lifecycle hooks) copied verbatim. See
// receiver.test.ts for the sibling suites' contract.

import { mkdtempSync, rmSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, describe, expect, test } from 'bun:test'

import { startTriggerReceiver, type TriggerDelivery } from '../receiver'
import { TriggerStore } from '../trigger-store'

const CONFIG_ROOTS: string[] = []

function freshStore(): { store: TriggerStore; secret: string; id: string } {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-trg-receiver-'))
  CONFIG_ROOTS.push(root)
  const store = new TriggerStore(path.join(root, 'triggers.json'))
  const created = store.create({ name: 'receiver-test' })
  return { store, secret: created.secret, id: created.id }
}

describe('trigger receiver', () => {
  let handles: Array<{ stop: () => void }> = []

  afterAll(() => {
    for (const root of CONFIG_ROOTS)
      rmSync(root, { recursive: true, force: true })
  })

  afterEach(() => {
    for (const h of handles) h.stop()
    handles = []
  })

  async function startWith(store: TriggerStore, deliveries: TriggerDelivery[]) {
    const handle = await startTriggerReceiver({
      port: 0,
      gatewayPort: 0,
      store,
      onDelivery: (d) => {
        deliveries.push(d)
        return Promise.resolve()
      },
    })
    handles.push(handle)
    return handle
  }

  /**
   * node:http probe — IMMUNE to globalThis.fetch mocks. Other suites
   * patch fetch and some leak the mock into the shared test process
   * (same hazard the gateway suite documents at gateway.test.ts:47),
   * which turns every fetch into a fake 200. Loopback probes go through
   * the node http client so they always hit the real socket.
   */
  function probe(
    url: string,
    options: {
      method?: string
      headers?: Record<string, string>
      body?: string
    } = {},
  ): Promise<{
    status: number
    body: string
    headers: Record<string, string | string[] | undefined>
  }> {
    return new Promise((resolve, reject) => {
      const target = new URL(url)
      const req = http.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: `${target.pathname}${target.search}`,
          method: options.method ?? 'GET',
          headers: options.headers,
        },
        (res) => {
          let body = ''
          res.on('data', (chunk) => (body += String(chunk)))
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              body,
              headers: res.headers,
            }),
          )
        },
      )
      req.on('error', (error) => reject(error))
      if (options.body !== undefined) req.write(options.body)
      req.end()
    })
  }

  function post(
    base: string,
    id: string,
    secret: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<{
    status: number
    body: string
    headers: Record<string, string | string[] | undefined>
  }> {
    return probe(`http://${base}/hooks/${id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
        'x-savant-nonce': `n-${Math.random()}`,
        'x-savant-timestamp': String(Date.now()),
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  test('flood beyond the window limit → 429 with Retry-After, no deliveries', async () => {
    const { store, secret, id } = freshStore()
    const deliveries: TriggerDelivery[] = []
    const handle = await startWith(store, deliveries)

    const results: number[] = []
    for (let i = 0; i < 8; i += 1) {
      const res = await post(handle.bound, id, secret, {
        eventId: `flood-${i}`,
      })
      results.push(res.status)
    }
    // 202s while under the limit, then 429 with a positive Retry-After.
    const rejected = results.filter((s) => s === 429)
    expect(rejected.length).toBeGreaterThan(0)
    const idx = results.indexOf(429)
    expect(idx).toBeGreaterThan(0)
    for (const s of results.slice(idx)) expect(s).toBe(429)
    expect(deliveries.length).toBeLessThan(8)
  })

  test('429 responses are accounted separately from delivery dedup', async () => {
    const { store, secret, id } = freshStore()
    const deliveries: TriggerDelivery[] = []
    const handle = await startWith(store, deliveries)

    // Saturate the window.
    for (let i = 0; i < 10; i += 1) {
      await post(handle.bound, id, secret, { eventId: `s-${i}` })
    }
    const saturated = await post(handle.bound, id, secret, {
      eventId: 's-after-window',
    })
    expect(saturated.status).toBe(429)
    expect(saturated.body).toMatch(/rate limited/i)
    const retryAfter = Number(saturated.headers['retry-after'] ?? '0')
    expect(retryAfter).toBeGreaterThan(0)
  })

  test('rate limiting is per-trigger: another trigger is unaffected', async () => {
    const { store, secret, id } = freshStore()
    const other = store.create({ name: 'other-trigger' })
    const deliveries: TriggerDelivery[] = []
    const handle = await startWith(store, deliveries)

    // Saturate the first trigger's window.
    for (let i = 0; i < 10; i += 1) {
      await post(handle.bound, id, secret, { eventId: `x-${i}` })
    }
    // The other trigger's window is independent.
    const res = await post(handle.bound, other.id, other.secret, {
      eventId: 'y-1',
    })
    expect(res.status).toBe(202)
  })

  test('the window resets: after the window passes, deliveries flow again', async () => {
    const { store, secret, id } = freshStore()
    const deliveries: TriggerDelivery[] = []
    // Injected clock (DI, no timer mocking): the receiver buckets AND
    // checks the replay window by it. The box starts at the REAL now so
    // the timestamps `post()` attaches (Date.now-based) sit inside the
    // ±5 min replay window.
    const boxed = { now: Date.now() }
    const handle = await startTriggerReceiver({
      port: 0,
      gatewayPort: 0,
      store,
      clock: () => boxed.now,
      onDelivery: (d) => {
        deliveries.push(d)
        return Promise.resolve()
      },
    })
    handles.push(handle)

    for (let i = 0; i < 10; i += 1) {
      await post(handle.bound, id, secret, { eventId: `w-${i}` })
    }
    const limited = await post(handle.bound, id, secret, {
      eventId: 'w-limited',
    })
    expect(limited.status).toBe(429)

    // Advance past the fixed window → the bucket resets.
    boxed.now += 61_000
    const after = await post(handle.bound, id, secret, {
      eventId: 'w-after-window',
    })
    expect(after.status).toBe(202)
  })
})
