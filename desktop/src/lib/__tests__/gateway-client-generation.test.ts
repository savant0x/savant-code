// FID-2026-1011-006 R13 — connection-generation ownership. A superseded
// socket's callbacks must not mutate the current connection's state, and a
// transport that fires its handlers synchronously must still complete the
// handshake. Sibling of gateway-client.test.ts (quality line ceiling).

import { describe, expect, test } from 'bun:test'

import { GatewayClient } from '../gateway-client'

import type {
  TransportConnection,
  TransportFactory,
  TransportHandlers,
} from '../gateway-client'

type FakeServer = {
  url: string
  handlers: TransportHandlers | null
  sent: string[]
  closed: boolean
  deliver(frame: unknown): void
  methods(): string[]
}

function makeFakeServer(): FakeServer {
  const fake: FakeServer = {
    url: '',
    handlers: null,
    sent: [],
    closed: false,
    deliver(frame: unknown): void {
      if (fake.handlers === null) throw new Error('transport not opened')
      fake.handlers.onMessage(JSON.stringify(frame))
    },
    methods(): string[] {
      return fake.sent.map(
        (raw) => (JSON.parse(raw) as { method?: string }).method ?? '',
      )
    },
  }
  return fake
}

function makeFactory(
  server: FakeServer,
  hooks: { onOpenSync?: boolean; onCloseSync?: boolean } = {},
): TransportFactory {
  return (url, handlers) => {
    server.url = url
    server.handlers = handlers
    if (hooks.onOpenSync) handlers.onOpen()
    if (hooks.onCloseSync) handlers.onClose()
    return {
      send: (data: string) => {
        server.sent.push(data)
      },
      close: () => {
        server.closed = true
      },
    } satisfies TransportConnection
  }
}

function requireHandlers(server: FakeServer): TransportHandlers {
  if (server.handlers === null) throw new Error('transport not opened')
  return server.handlers
}

function lastId(server: FakeServer): number {
  const raw = server.sent[server.sent.length - 1]
  if (raw === undefined) throw new Error('no frame has been sent')
  return (JSON.parse(raw) as { id: number }).id
}

function helloReply(id: number, projectId: string, eventSeq?: number): unknown {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: 1,
      capabilities: ['hello', 'replay_events'],
      projectId,
      ...(eventSeq === undefined ? {} : { eventSeq }),
    },
  }
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe('FID-2026-1011-006 connection generations', () => {
  test('stale message and close callbacks cannot emit events or alter status', async () => {
    const a = makeFakeServer()
    const b = makeFakeServer()
    let created = 0
    const client = new GatewayClient({
      factory: (url, handlers) =>
        makeFactory(created++ === 0 ? a : b)(url, handlers),
      requestTimeoutMs: 250,
    })
    const received: number[] = []
    client.onEvents((events) => received.push(events.length))
    client.connect({ port: 5151, token: 'a' })
    requireHandlers(a).onOpen()
    client.connect({ port: 5152, token: 'b' })
    requireHandlers(b).onOpen()
    await flush()
    b.deliver(helloReply(lastId(b), 'repo-b'))
    await flush()
    expect(client.getStatus()).toBe('ready')

    // Frames and closes arriving from the retired socket are inert.
    requireHandlers(a).onMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'event',
        params: [{ type: 'text', text: 'stale' }],
      }),
    )
    requireHandlers(a).onClose()
    b.deliver(helloReply(lastId(b), 'repo-b'))
    await flush()
    expect(received).toEqual([])
    expect(client.getStatus()).toBe('ready')
    expect(client.getProjectId()).toBe('repo-b')
    expect(b.closed).toBe(false)
    client.close()
  })

  test('a stale close during the replacement handshake cannot invalidate it', async () => {
    const a = makeFakeServer()
    const b = makeFakeServer()
    let created = 0
    const client = new GatewayClient({
      factory: (url, handlers) =>
        makeFactory(created++ === 0 ? a : b)(url, handlers),
      requestTimeoutMs: 250,
    })
    client.connect({ port: 5151, token: 'a' })
    requireHandlers(a).onOpen()
    await flush()
    // B is authenticating: its hello is in flight.
    client.connect({ port: 5152, token: 'b' })
    requireHandlers(b).onOpen()
    requireHandlers(a).onClose()
    await flush()
    b.deliver(helloReply(lastId(b), 'repo-b'))
    await flush()
    expect(client.getStatus()).toBe('ready')
    b.deliver({
      jsonrpc: '2.0',
      id: lastId(b),
      result: { accepted: true },
    })
    expect(client.getProjectId()).toBe('repo-b')
    client.close()
  })

  test('a duplicate disconnect on one socket reconnects exactly once', async () => {
    const server = makeFakeServer()
    const statuses: string[] = []
    const client = new GatewayClient({
      factory: makeFactory(server),
      requestTimeoutMs: 250,
    })
    client.onStatus((status) => statuses.push(status))
    client.connect({ port: 5151, token: 'sekrit' })
    const handlers = requireHandlers(server)
    handlers.onOpen()
    await flush()
    handlers.onClose()
    handlers.onClose()
    handlers.onClose()
    expect(statuses.filter((status) => status === 'reconnecting')).toHaveLength(
      1,
    )
    client.close()
    expect(client.getStatus()).toBe('offline')
  })

  test('synchronous transport callbacks still reach and complete the handshake', async () => {
    const opened = makeFakeServer()
    const client = new GatewayClient({
      factory: makeFactory(opened, { onOpenSync: true }),
    })
    client.connect({ port: 5151, token: 'sekrit' })
    // onOpen ran before the socket was assigned: the handshake starts on
    // assignment instead of being dropped.
    expect(opened.methods()).toEqual(['hello'])
    expect(client.getStatus()).toBe('authenticating')
    client.close()

    const closed = makeFakeServer()
    const failing = new GatewayClient({
      factory: makeFactory(closed, { onCloseSync: true }),
      requestTimeoutMs: 250,
    })
    failing.connect({ port: 5151, token: 'sekrit' })
    expect(closed.closed).toBe(true)
    expect(failing.getStatus()).toBe('reconnecting')
    failing.close()
  })

  test('the same owner keeps the replay cursor; another owner re-baselines', async () => {
    const a = makeFakeServer()
    const client = new GatewayClient({
      factory: makeFactory(a),
      requestTimeoutMs: 250,
    })
    client.connect({ port: 5151, token: 'sekrit' })
    requireHandlers(a).onOpen()
    await flush()
    a.deliver(helloReply(lastId(a), 'repo-a', 5))
    await flush()
    expect(client.getStatus()).toBe('ready')

    // Same owner (port + token): the cursor survives, so a server that moved
    // ahead is asked to replay the gap.
    client.connect({ port: 5151, token: 'sekrit' })
    requireHandlers(a).onOpen()
    await flush()
    a.deliver(helloReply(lastId(a), 'repo-a', 7))
    await flush()
    expect(a.methods()).toContain('replay_events')
    client.close()

    const b = makeFakeServer()
    const other = new GatewayClient({
      factory: makeFactory(b),
      requestTimeoutMs: 250,
    })
    other.connect({ port: 5151, token: 'sekrit' })
    requireHandlers(b).onOpen()
    await flush()
    b.deliver(helloReply(lastId(b), 'repo-b', 5))
    await flush()
    // A different owner forgets the cursor entirely: the first hello after
    // the switch is a baseline, never a replay against another project's seqs.
    other.connect({ port: 5152, token: 'sekrit' })
    requireHandlers(b).onOpen()
    await flush()
    const baselineHelloId = lastId(b)
    b.sent.length = 0
    b.deliver(helloReply(baselineHelloId, 'repo-b', 9))
    await flush()
    expect(b.methods()).not.toContain('replay_events')
    other.close()
  })
})
