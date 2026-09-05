import { describe, expect, test } from 'bun:test'

import { GatewayClient, backoffDelayMs } from '../gateway-client'

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
  /** Simulate the gateway sending one raw JSON-RPC frame. */
  deliver(frame: unknown): void
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
  }
  return fake
}

function makeFactory(server: FakeServer): TransportFactory {
  return (url, handlers) => {
    server.url = url
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

/** Drive a client through connect → open → hello → ready. */
async function makeReadyClient(server: FakeServer): Promise<GatewayClient> {
  const client = new GatewayClient({
    factory: makeFactory(server),
    requestTimeoutMs: 250,
  })
  client.connect({ port: 5151, token: 'sekrit' })
  requireHandlers(server).onOpen()
  await flush()
  const hello = JSON.parse(lastSent(server)) as { id: number; method: string }
  if (hello.method !== 'hello') {
    throw new Error(`expected hello, got ${hello.method}`)
  }
  requireHandlers(server).onMessage(
    JSON.stringify({
      jsonrpc: '2.0',
      id: hello.id,
      result: {
        protocolVersion: 1,
        capabilities: ['hello'],
        projectId: 'repo-a',
      },
    }),
  )
  // The handshake continuation runs on a microtask after the reply lands.
  await flush()
  if (client.getStatus() !== 'ready')
    throw new Error('client did not reach ready')
  return client
}

describe('backoffDelayMs', () => {
  test('doubles from 1s and caps at 15s', () => {
    expect(backoffDelayMs(1)).toBe(1000)
    expect(backoffDelayMs(2)).toBe(2000)
    expect(backoffDelayMs(3)).toBe(4000)
    expect(backoffDelayMs(4)).toBe(8000)
    expect(backoffDelayMs(5)).toBe(15000)
    expect(backoffDelayMs(9)).toBe(15000)
  })
})

describe('GatewayClient', () => {
  test('handshake sends hello-first with token and reaches ready', async () => {
    const server = makeFakeServer()
    const statuses: string[] = []
    const client = new GatewayClient({ factory: makeFactory(server) })
    client.onStatus((status) => statuses.push(status))
    client.connect({ port: 5151, token: 'sekrit' })
    requireHandlers(server).onOpen()

    const helloFrame = JSON.parse(lastSent(server)) as {
      method: string
      params: Record<string, unknown>
    }
    expect(helloFrame.method).toBe('hello')
    expect(helloFrame.params).toEqual({ protocolVersion: 1, token: 'sekrit' })
    expect(server.url).toBe('ws://127.0.0.1:5151/ws')

    server.deliver({
      jsonrpc: '2.0',
      id: (JSON.parse(server.sent[0]) as { id: number }).id,
      result: {
        protocolVersion: 1,
        capabilities: ['hello'],
        projectId: 'repo-a',
      },
    })
    await flush()
    expect(client.getStatus()).toBe('ready')
    expect(client.getProjectId()).toBe('repo-a')
    expect(statuses).toEqual(['connecting', 'authenticating', 'ready'])
  })

  test('auth failure closes and schedules reconnecting backoff', async () => {
    const server = makeFakeServer()
    const client = new GatewayClient({
      factory: makeFactory(server),
      requestTimeoutMs: 250,
    })
    client.connect({ port: 5151, token: 'wrong' })
    const handlers = requireHandlers(server)
    handlers.onOpen()
    await flush()
    const hello = JSON.parse(lastSent(server)) as { id: number }
    server.deliver({
      jsonrpc: '2.0',
      id: hello.id,
      error: {
        code: -32001,
        message: 'Unauthorized: bad or missing bearer token',
      },
    })
    await flush()
    // The handshake failure closed the socket client-side; simulate the
    // resulting remote close event.
    handlers.onClose()
    expect(client.getStatus()).toBe('reconnecting')
    expect(server.closed).toBe(true)

    // Manual close stops the reconnect ladder and lands offline.
    client.close()
    expect(client.getStatus()).toBe('offline')
  })

  test('sendUserMessage correlates its response', async () => {
    const server = makeFakeServer()
    const client = await makeReadyClient(server)
    const pending = client.sendUserMessage('do it')
    const request = JSON.parse(lastSent(server)) as {
      id: number
      method: string
      params: Record<string, unknown>
    }
    expect(request.method).toBe('user_message')
    expect(request.params.prompt).toBe('do it')
    server.deliver({
      jsonrpc: '2.0',
      id: request.id,
      result: { accepted: true },
    })
    await expect(pending).resolves.toBeUndefined()
  })

  test('a timed-out request rejects without hanging the client', async () => {
    const server = makeFakeServer()
    const client = new GatewayClient({
      factory: makeFactory(server),
      requestTimeoutMs: 10,
    })
    client.connect({ port: 5151, token: 'sekrit' })
    requireHandlers(server).onOpen()
    await flush()
    // Never answer the hello; wait out the timeout.
    await new Promise<void>((resolve) => setTimeout(resolve, 40))
    await expect(client.sendUserMessage('late')).rejects.toThrow(/not ready/)
    client.close()
  })

  test('failure frames reject with the gateway error code', async () => {
    const server = makeFakeServer()
    const client = await makeReadyClient(server)
    const pending = client.respondApproval('A1', [], true)
    const request = JSON.parse(lastSent(server)) as {
      id: number
      method: string
      params: { approvalId: string; response?: { skipped: boolean } }
    }
    expect(request.method).toBe('approval_response')
    expect(request.params.approvalId).toBe('A1')
    expect(request.params.response?.skipped).toBe(true)
    server.deliver({
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32600, message: 'Unknown approvalId' },
    })
    await expect(pending).rejects.toMatchObject({ code: -32600 })
  })

  test('requests before auth are rejected locally', () => {
    const server = makeFakeServer()
    const client = new GatewayClient({ factory: makeFactory(server) })
    expect(() => client.sendUserMessage('x')).toThrow(/not ready/)
    expect(() => client.interrupt()).toThrow(/not ready/)
  })

  test('event batches reach registered listeners', async () => {
    const server = makeFakeServer()
    const client = await makeReadyClient(server)
    const received: number[] = []
    client.onEvents((events) => received.push(events.length))
    server.deliver({
      jsonrpc: '2.0',
      method: 'event',
      params: [
        { type: 'text', text: 'a' },
        { type: 'error', message: 'b' },
      ],
    })
    expect(received).toEqual([2])
    client.close()
  })

  test('manual close disconnects cleanly to offline', async () => {
    const server = makeFakeServer()
    const client = await makeReadyClient(server)
    client.close()
    expect(server.closed).toBe(true)
    expect(client.getStatus()).toBe('offline')
  })
})
