// FID-2026-0819-005 Loop 223 (second cut): scoped-thread correlation suites,
// moved verbatim from gateway-client.test.ts (parent still over the ceiling
// after the connectOnce move). See gateway-client.test.ts for the sibling
// suites' contract.

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
  if (client.getStatus() !== 'ready') {
    throw new Error('client did not reach ready')
  }
  return client
}

describe('GatewayClient scoped threads', () => {
  test('getScopedThreads correlates and validates a persisted thread response', async () => {
    const server = makeFakeServer()
    const client = await makeReadyClient(server)
    const pending = client.getScopedThreads('project', 'repo-a')
    const request = JSON.parse(lastSent(server)) as {
      id: number
      method: string
      params: { scopeType: string; scopeId: string }
    }
    expect(request.method).toBe('get_scoped_threads')
    expect(request.params).toEqual({ scopeType: 'project', scopeId: 'repo-a' })
    server.deliver({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        scopeType: 'project',
        scopeId: 'repo-a',
        threads: [
          {
            sessionId: 's1',
            chatId: 'c1',
            agentId: 'orchestrator',
            unread: true,
            pinned: false,
            messages: [
              {
                id: 'm1',
                role: 'user',
                content: 'persisted',
                createdAt: '2026-08-25T00:00:00Z',
              },
            ],
          },
        ],
      },
    })
    await expect(pending).resolves.toMatchObject({
      scopeType: 'project',
      threads: [{ messages: [{ content: 'persisted' }] }],
    })
    client.close()
  })

  test('updateScopedThreadState correlates its persisted result', async () => {
    const server = makeFakeServer()
    const client = await makeReadyClient(server)
    const pending = client.updateScopedThreadState('s1', { unread: false })
    const request = JSON.parse(lastSent(server)) as {
      id: number
      method: string
      params: { sessionId: string; unread: boolean }
    }
    expect(request.method).toBe('update_scoped_thread_state')
    expect(request.params).toEqual({ sessionId: 's1', unread: false })
    server.deliver({
      jsonrpc: '2.0',
      id: request.id,
      result: { updated: true },
    })
    await expect(pending).resolves.toEqual({ updated: true })
    client.close()
  })
})
