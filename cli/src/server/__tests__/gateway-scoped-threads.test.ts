import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { startGateway } from '../gateway'
import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  createFakeRunPrompt,
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

describe('gateway scoped thread read', () => {
  test('returns the injected scoped thread payload through JSON-RPC', async () => {
    let gateway = await startTestGateway()
    gateway?.stop()
    gateway = await startGateway({
      token: TEST_TOKEN,
      port: 0,
      allowedOrigins: ['tauri://localhost', 'http://tauri.localhost'],
      runPrompt: createFakeRunPrompt({}),
      fidsDir: mkdtempSync(path.join(tmpdir(), 'savant-fid-gateway-')),
      loadScopedThreads: ({ scopeType, scopeId }) => [
        {
          sessionId: 'session-1',
          chatId: 'chat-1',
          agentId: 'orchestrator',
          unread: true,
          pinned: false,
          messages: [
            {
              id: 'message-1',
              role: 'user',
              content: `loaded:${scopeType}:${scopeId}`,
              createdAt: '2026-08-25T00:00:00Z',
            },
          ],
        },
      ],
      updateScopedThreadState: ({ sessionId, unread, pinned }) =>
        sessionId === 'session-1' &&
        (unread !== undefined || pinned !== undefined),
    })
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    const response = (await request(
      socket,
      'get_scoped_threads',
      { scopeType: 'global', scopeId: 'fleet' },
      2,
    )) as {
      result?: { scopeType: string; scopeId: string; threads: unknown[] }
    }
    expect(response.result).toMatchObject({
      scopeType: 'global',
      scopeId: 'fleet',
      threads: [
        {
          messages: [{ content: 'loaded:global:fleet' }],
        },
      ],
    })
    const updated = (await request(
      socket,
      'update_scoped_thread_state',
      { sessionId: 'session-1', unread: false, pinned: true },
      3,
    )) as { result?: { updated: boolean } }
    expect(updated.result?.updated).toBe(true)
    socket.close()
  })

  test('rejects malformed scoped thread requests', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    const response = (await request(
      socket,
      'get_scoped_threads',
      { scopeType: 'project' },
      2,
    )) as { error?: { code: number } }
    expect(response.error?.code).toBe(-32600)
    socket.close()
  })
})
