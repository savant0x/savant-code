// FID-2026-1003-002 (T113 audit D6) — desktop client reconnect replay.
//
// The client keeps a cursor: baselined from hello.eventSeq, advanced per
// live batch, and on a reconnect hello ahead of the cursor it fires
// `replay_events {since: cursor}` and feeds the recovered batches through
// the SAME onEvents seam. Faults surface via onReplayGap.

import { describe, expect, test } from 'bun:test'

import { GatewayClient } from '../gateway-client'

import type {
  TransportConnection,
  TransportFactory,
  TransportHandlers,
} from '../gateway-client'

type FakeServer = {
  handlers: TransportHandlers | null
  sent: string[]
  closed: boolean
  deliver(frame: unknown): void
}

function makeFakeServer(): FakeServer {
  const fake: FakeServer = {
    handlers: null,
    sent: [],
    closed: false,
    deliver(frame: unknown): void {
      if (fake.handlers === null) throw new Error('transport not opened')
      fake.handlers.onMessage(JSON.stringify(frame))
    },
  }
  return fake
}

function makeFactory(server: FakeServer): TransportFactory {
  return (url, handlers) => {
    server.handlers = handlers
    const connection: TransportConnection = {
      send: (data: string) => {
        server.sent.push(data)
      },
      close: () => {
        server.closed = true
      },
    }
    return connection
  }
}

function requireHandlers(server: FakeServer): TransportHandlers {
  if (server.handlers === null) throw new Error('transport not opened')
  return server.handlers
}

function lastSent(server: FakeServer): string {
  const raw = server.sent[server.sent.length - 1]
  if (raw === undefined) throw new Error('no frame has been sent')
  return raw
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function helloResult(
  id: number,
  eventSeq: number | undefined,
  capabilities: string[] = ['replay_events'],
): unknown {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: 1,
      capabilities,
      projectId: 'repo-a',
      ...(eventSeq !== undefined ? { eventSeq } : {}),
    },
  }
}

/** Drive a client through connect → open → hello → ready, answering the
 *  hello with the given eventSeq. Returns the hello frame's id. */
async function helloAndReady(
  server: FakeServer,
  client: GatewayClient,
  eventSeq: number | undefined,
  capabilities: string[] = ['replay_events'],
): Promise<number> {
  requireHandlers(server).onOpen()
  await flush()
  const hello = JSON.parse(lastSent(server)) as { id: number; method: string }
  if (hello.method !== 'hello') {
    throw new Error(`expected hello, got ${hello.method}`)
  }
  server.deliver(helloResult(hello.id, eventSeq, capabilities))
  await flush()
  if (client.getStatus() !== 'ready') {
    throw new Error('client did not reach ready')
  }
  return hello.id
}

describe('gateway client replay (FID-2026-1003-002 / audit D6)', () => {
  test('first hello baselines the cursor and fires no replay; reconnect replays the gap', async () => {
    const server = makeFakeServer()
    const client = new GatewayClient({
      factory: makeFactory(server),
      requestTimeoutMs: 250,
    })
    const texts: string[] = []
    client.onEvents((events) => {
      for (const event of events) {
        if (event.type === 'text') texts.push(event.text)
      }
    })

    client.connect({ port: 5151, token: 'sekrit' })
    await helloAndReady(server, client, 5)
    // Baseline only — nothing is owed on the first hello.
    expect(server.sent).toHaveLength(1)

    // One live batch advances the cursor (5 → 6).
    server.deliver({
      jsonrpc: '2.0',
      method: 'event',
      params: [{ type: 'text', text: 'a' }],
    })
    expect(texts).toEqual(['a'])

    // Disconnect; the reconnect timer is bypassed by an explicit connect()
    // on the same instance (the resume case).
    requireHandlers(server).onClose()
    expect(client.getStatus()).toBe('reconnecting')
    client.connect({ port: 5151, token: 'sekrit' })
    await helloAndReady(server, client, 8)

    // The client replayed its exact gap: since = 6.
    const replay = JSON.parse(lastSent(server)) as {
      id: number
      method: string
      params: { since: number }
    }
    expect(replay.method).toBe('replay_events')
    expect(replay.params).toEqual({ since: 6 })

    server.deliver({
      jsonrpc: '2.0',
      id: replay.id,
      result: {
        batches: [
          { seq: 7, events: [{ type: 'text', text: 'b' }] },
          { seq: 8, events: [{ type: 'text', text: 'c' }] },
        ],
        earliestSeq: 7,
        latestSeq: 8,
        gapped: false,
      },
    })
    await flush()
    // Recovered batches flow through the same onEvents seam, in order.
    expect(texts).toEqual(['a', 'b', 'c'])

    // The cursor advanced to 8: the NEXT reconnect replays only from 8.
    requireHandlers(server).onClose()
    client.connect({ port: 5151, token: 'sekrit' })
    await helloAndReady(server, client, 9)
    const replay2 = JSON.parse(lastSent(server)) as {
      method: string
      params: { since: number }
    }
    expect(replay2.method).toBe('replay_events')
    expect(replay2.params).toEqual({ since: 8 })
    client.close()
  })

  test('a gapped replay recovers what it can and surfaces the gap', async () => {
    const server = makeFakeServer()
    const client = new GatewayClient({
      factory: makeFactory(server),
      requestTimeoutMs: 250,
    })
    const texts: string[] = []
    client.onEvents((events) => {
      for (const event of events) {
        if (event.type === 'text') texts.push(event.text)
      }
    })
    const gaps: string[] = []
    client.onReplayGap((info) => gaps.push(info.reason))

    client.connect({ port: 5151, token: 'sekrit' })
    await helloAndReady(server, client, 2)
    requireHandlers(server).onClose()
    client.connect({ port: 5151, token: 'sekrit' })
    await helloAndReady(server, client, 9)

    const replay = JSON.parse(lastSent(server)) as { id: number }
    server.deliver({
      jsonrpc: '2.0',
      id: replay.id,
      result: {
        batches: [{ seq: 8, events: [{ type: 'text', text: 'tail' }] }],
        earliestSeq: 8,
        latestSeq: 9,
        gapped: true,
      },
    })
    await flush()
    expect(texts).toEqual(['tail'])
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('replay window')
    client.close()
  })

  test('an old sidecar without eventSeq keeps v1 behavior', async () => {
    const server = makeFakeServer()
    const client = new GatewayClient({
      factory: makeFactory(server),
      requestTimeoutMs: 250,
    })
    const texts: string[] = []
    client.onEvents((events) => {
      for (const event of events) {
        if (event.type === 'text') texts.push(event.text)
      }
    })

    client.connect({ port: 5151, token: 'sekrit' })
    await helloAndReady(server, client, undefined, ['hello'])
    server.deliver({
      jsonrpc: '2.0',
      method: 'event',
      params: [{ type: 'text', text: 'live' }],
    })
    expect(texts).toEqual(['live'])

    requireHandlers(server).onClose()
    client.connect({ port: 5151, token: 'sekrit' })
    await helloAndReady(server, client, undefined, ['hello'])
    // No cursor → no replay request, ever.
    expect(server.sent.filter((raw) => raw.includes('replay_events'))).toEqual(
      [],
    )
    client.close()
  })

  test('a failed replay surfaces a gap and the client stays ready', async () => {
    const server = makeFakeServer()
    const client = new GatewayClient({
      factory: makeFactory(server),
      requestTimeoutMs: 250,
    })
    const gaps: string[] = []
    client.onReplayGap((info) => gaps.push(info.reason))

    client.connect({ port: 5151, token: 'sekrit' })
    await helloAndReady(server, client, 3)
    requireHandlers(server).onClose()
    client.connect({ port: 5151, token: 'sekrit' })
    await helloAndReady(server, client, 6)
    const replay = JSON.parse(lastSent(server)) as { id: number }
    server.deliver({
      jsonrpc: '2.0',
      id: replay.id,
      error: { code: -32600, message: 'replay boom' },
    })
    await flush()
    expect(gaps).toEqual(['replay request failed'])
    expect(client.getStatus()).toBe('ready')
    client.close()
  })
})
