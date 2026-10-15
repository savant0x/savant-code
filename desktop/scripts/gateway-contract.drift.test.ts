// Drift guard: the client-mirrored gateway constants must stay equal to the
// server source of truth (cli/src/server/json-rpc.ts). This applies the
// repo's generated-artifact drift-guard pattern to frozen constants — the
// desktop webview cannot import the cli workspace, so the mirror is asserted
// against the server file text on every test run.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

const SERVER_PATH = join(
  import.meta.dir,
  '..',
  '..',
  'cli',
  'src',
  'server',
  'json-rpc.ts',
)
const CLIENT_PATH = join(
  import.meta.dir,
  '..',
  'src',
  'lib',
  'gateway-protocol.ts',
)

const CODE_NAMES = [
  'unauthorized',
  'originRejected',
  'unsupportedProtocolVersion',
  'sessionBusy',
  'invalidRequest',
  'methodNotFound',
  'internalError',
] as const

function extractErrorCodes(source: string): Record<string, number> {
  const map: Record<string, number> = {}
  for (const name of CODE_NAMES) {
    const match = new RegExp(`${name}:\\s*(-\\d+)`).exec(source)
    if (match === null) {
      throw new Error(`error code ${name} not found in source`)
    }
    map[name] = Number(match[1])
  }
  return map
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('gateway v1 contract drift guard', () => {
  test('client mirrors every reserved error code from the server source', () => {
    const serverCodes = extractErrorCodes(readSource(SERVER_PATH))
    const clientCodes = extractErrorCodes(readSource(CLIENT_PATH))
    expect(clientCodes).toEqual(serverCodes)
  })

  test('protocol version stays frozen at 1 on both sides', () => {
    const pattern = /GATEWAY_PROTOCOL_VERSION\s*=\s*1\b/
    expect(pattern.test(readSource(SERVER_PATH))).toBe(true)
    expect(pattern.test(readSource(CLIENT_PATH))).toBe(true)
  })
})
