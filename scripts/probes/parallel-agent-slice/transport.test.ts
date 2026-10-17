import { expect, test } from 'bun:test'

import { installRequestGuard } from './transport'

const URL = 'https://api.apixoai.online/v1/chat/completions'

test('HTTP retries consume the same cumulative ceiling; unrelated hosts never dispatch', async () => {
  const original = globalThis.fetch
  let sends = 0
  globalThis.fetch = Object.assign(
    async () => {
      sends += 1
      return new Response('ok')
    },
    { preconnect: original.preconnect },
  )
  const guard = installRequestGuard({
    maxRequests: 2,
    concurrency: 1,
    signal: new AbortController().signal,
  })
  try {
    await (await fetch(URL)).text()
    await (await fetch(URL)).text()
    await expect(fetch(URL)).rejects.toThrow('ceiling')
    await expect(fetch('https://example.invalid/')).rejects.toThrow(
      'destination',
    )
    expect(sends).toBe(2)
    expect(guard.records).toHaveLength(2)
    expect(
      guard.records.every((record) => record.finishedAt !== undefined),
    ).toBe(true)
  } finally {
    guard.restore()
    globalThis.fetch = original
  }
})

test('stream headers do not release the permit; a queued request can cancel', async () => {
  const original = globalThis.fetch
  const body = new TransformStream<Uint8Array, Uint8Array>()
  let sends = 0
  globalThis.fetch = Object.assign(
    async () => {
      sends += 1
      return new Response(body.readable)
    },
    { preconnect: original.preconnect },
  )
  const controller = new AbortController()
  const guard = installRequestGuard({
    maxRequests: 2,
    concurrency: 1,
    signal: controller.signal,
  })
  try {
    const first = await fetch(URL)
    const second = fetch(URL)
    await Promise.resolve()
    expect(sends).toBe(1)
    controller.abort()
    await expect(second).rejects.toThrow('cancel')
    await first.body?.cancel()
    expect(guard.records[0]?.finishedAt).toBeDefined()
  } finally {
    guard.restore()
    globalThis.fetch = original
  }
})
