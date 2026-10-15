import http from 'node:http'

import { describe, expect, test } from 'bun:test'

import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

/**
 * Probe the gateway's /ws upgrade with node:http. Other suites replace
 * globalThis.fetch (some leak the mock), so the Origin-rejection probes use
 * the node http client instead of fetch — immune to fetch mocks.
 */
function probeUpgrade(
  port: number,
  origin?: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      upgrade: 'websocket',
      connection: 'Upgrade',
      'sec-websocket-key': 'x3JJHMbDL1EzLkh9GBhXDw==',
      'sec-websocket-version': '13',
    }
    if (origin !== undefined) headers.origin = origin
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/ws', method: 'GET', headers },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += String(chunk)))
        res.on('end', () => {
          let parsed: unknown = body
          try {
            parsed = JSON.parse(body)
          } catch {
            // non-JSON body
          }
          resolve({ status: res.statusCode ?? 0, body: parsed })
        })
      },
    )
    req.on('error', (error) => reject(error))
    req.end()
  })
}

describe('gateway Origin/Host validation', () => {
  test('a mismatched Origin is rejected at the upgrade (403 + -32002)', async () => {
    const gateway = await startTestGateway()
    const res = await probeUpgrade(gateway.port, 'https://evil.example.com')
    expect(res.status).toBe(403)
    const body = res.body as { error?: { code: number } }
    expect(body.error?.code).toBe(-32002)
  })

  test('a missing Origin is rejected at the upgrade', async () => {
    const gateway = await startTestGateway()
    const res = await probeUpgrade(gateway.port)
    expect(res.status).toBe(403)
  })

  test('an allowed Origin upgrades successfully', async () => {
    const gateway = await startTestGateway()
    const socket = await openSocket(gateway.port, 'http://tauri.localhost')
    const response = (await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      20,
    )) as { result?: { protocolVersion: number } }
    expect(response.result?.protocolVersion).toBe(GATEWAY_PROTOCOL_VERSION)
    socket.close()
  })
})
