// FID-2026-0819-005 Loop 223: connectOnce (P35 boot-connect idempotence)
// suite, moved verbatim from gateway-client.test.ts (parent over the
// 300-line ceiling; dedented from its nested position, bodies unchanged).
// See gateway-client.test.ts for the sibling suites' contract.

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

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

// P35 (operator: "Project FIDs shows 0 open"): the boot connect used to be
// gated by a module-level flag in use-gateway that was fragile across HMR
// module generations — a remount could leave the shared client offline
// forever while the UI rendered, silently missing the gateway's hello-time
// FID inventory batch. connectOnce() owns the idempotence on the instance.
describe('connectOnce (P35 boot-connect idempotence)', () => {
  test('opens the socket on first call and ignores subsequent calls', () => {
    const server = makeFakeServer()
    const client = new GatewayClient({ factory: makeFactory(server) })
    client.connectOnce({ port: 5151, token: 'sekrit' })
    expect(server.handlers).not.toBeNull()
    expect(client.getStatus()).toBe('connecting')
    // A second (and any further) call must not re-open or reset state.
    requireHandlers(server).onOpen()
    client.connectOnce({ port: 5151, token: 'sekrit' })
    client.connectOnce({ port: 5151, token: 'sekrit' })
    expect(server.sent.filter((f) => f.includes('"hello"'))).toHaveLength(1)
  })

  test('connect() stays explicit — it always (re)opens the socket', async () => {
    const server = makeFakeServer()
    const client = new GatewayClient({ factory: makeFactory(server) })
    client.connect({ port: 5151, token: 'sekrit' })
    requireHandlers(server).onOpen()
    await flush()
    client.connect({ port: 5151, token: 'sekrit' })
    // The factory was re-invoked (handlers replaced); the second hello
    // goes out once the new socket opens.
    requireHandlers(server).onOpen()
    await flush()
    expect(server.sent.filter((f) => f.includes('"hello"'))).toHaveLength(2)
  })

  test('close() resets the gate so a torn-down consumer can reconnect', async () => {
    const server = makeFakeServer()
    const client = new GatewayClient({ factory: makeFactory(server) })
    client.connectOnce({ port: 5151, token: 'sekrit' })
    requireHandlers(server).onOpen()
    await flush()
    client.close()
    expect(client.getStatus()).toBe('offline')
    // Same instance, new gate: connectOnce must open a fresh socket via
    // the same factory and drive a second hello on open.
    client.connectOnce({ port: 5151, token: 'sekrit' })
    requireHandlers(server).onOpen()
    await flush()
    // onOpen flips connecting → authenticating; the second hello is out.
    expect(client.getStatus()).toBe('authenticating')
    expect(server.sent.filter((f) => f.includes('"hello"'))).toHaveLength(2)
  })
})
