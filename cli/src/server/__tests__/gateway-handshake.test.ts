import { describe, expect, test } from 'bun:test'

import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

describe('gateway hello handshake (frozen v1)', () => {
  test('hello with valid protocolVersion + token replies with capabilities', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    const response = (await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      10,
    )) as { result?: { protocolVersion: number; capabilities: string[] } }
    expect(response.result?.protocolVersion).toBe(GATEWAY_PROTOCOL_VERSION)
    expect(response.result?.capabilities).toContain('user_message')
    socket.close()
  })

  test('bad token is rejected with -32001 (fail-closed)', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    const response = (await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: 'wrong-token' },
      11,
    )) as { error?: { code: number } }
    expect(response.error?.code).toBe(-32001)
    socket.close()
  })

  test('missing token is rejected with -32001', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    const response = (await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION },
      12,
    )) as { error?: { code: number } }
    expect(response.error?.code).toBe(-32001)
    socket.close()
  })

  test('unsupported protocol version is rejected with -32003 (never downgraded)', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    const response = (await request(
      socket,
      'hello',
      { protocolVersion: 99, token: TEST_TOKEN },
      13,
    )) as { error?: { code: number } }
    expect(response.error?.code).toBe(-32003)
    socket.close()
  })

  test('a non-hello first frame is rejected with -32600', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    const response = (await request(
      socket,
      'user_message',
      { prompt: 'hi' },
      14,
    )) as {
      error?: { code: number }
    }
    expect(response.error?.code).toBe(-32600)
    socket.close()
  })

  test('list_commands serves the full CLI registry with dispatch classes (FID-2026-0901-005)', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      30,
    )
    const response = (await request(socket, 'list_commands', {}, 31)) as {
      result?: { commands?: { id: string; dispatch: string }[] }
    }
    const commands = response.result?.commands ?? []
    // The full registry — far more than the desktop's old 4 hardcoded names.
    expect(commands.length).toBeGreaterThan(20)
    // Every entry is well-formed and dispatch-classified.
    for (const command of commands) {
      expect(typeof command.id).toBe('string')
      expect(['agent', 'client']).toContain(command.dispatch)
    }
    // Known backend commands are present and agent-dispatched.
    const compact = commands.find((command) => command.id === 'compact')
    expect(compact?.dispatch).toBe('agent')
    // TUI-only commands are honestly marked 'client' (not faked).
    const review = commands.find((command) => command.id === 'review')
    expect(review?.dispatch).toBe('client')
    socket.close()
  })

  test('methods before authentication are rejected with -32001', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    // First hello with a bad token (auth fails), then a method call.
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: 'nope' },
      15,
    )
    const response = (await request(
      socket,
      'update_setting',
      { key: 'x' },
      16,
    )) as {
      error?: { code: number }
    }
    expect(response.error?.code).toBe(-32001)
    socket.close()
  })
})
