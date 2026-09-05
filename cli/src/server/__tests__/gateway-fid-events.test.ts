import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

describe('gateway FID lifecycle events', () => {
  test('authenticated clients receive an initial FID snapshot and file changes', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'savant-fid-gateway-'))
    const fidsDir = path.join(root, 'dev', 'fids')
    mkdirSync(fidsDir, { recursive: true })
    const fidPath = path.join(fidsDir, 'FID-2026-0825-001-test.md')
    const writeFid = (status: string): void => {
      writeFileSync(
        fidPath,
        `| **ID** | FID-2026-0825-001 |\n| **Status** | ${status} |\n| **Severity** | low |\n| **Parent** | FID-2026-0824-008 |\n`,
      )
    }
    writeFid('created')
    const gateway = await startTestGateway({ fidsDir })
    const socket = await openSocket(gateway.port)
    const hello = (await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )) as { result?: { projectId?: string } }
    const expectedProjectId = path.basename(root)
    expect(hello.result?.projectId).toBe(expectedProjectId)
    const initial = await new Promise<{
      projectId: string
      parentId?: string
      status: string
    }>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('FID snapshot timeout')),
        2000,
      )
      const listener = (event: MessageEvent): void => {
        const frame = JSON.parse(String(event.data)) as {
          method?: string
          params?: PrintModeEvent[]
        }
        const update =
          frame.method === 'event'
            ? frame.params?.find((item) => item.type === 'fid_update')
            : undefined
        if (update?.type === 'fid_update') {
          clearTimeout(timer)
          socket.offMessage(listener)
          resolve({
            projectId: update.projectId,
            ...(update.parentId !== undefined
              ? { parentId: update.parentId }
              : {}),
            status: update.status,
          })
        }
      }
      socket.onMessage(listener)
    })
    expect(initial).toEqual({
      projectId: expectedProjectId,
      parentId: 'FID-2026-0824-008',
      status: 'created',
    })

    writeFid('verified')
    const changed = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('FID change timeout')),
        3000,
      )
      const listener = (event: MessageEvent): void => {
        const frame = JSON.parse(String(event.data)) as {
          method?: string
          params?: PrintModeEvent[]
        }
        const update =
          frame.method === 'event'
            ? frame.params?.find(
                (item) =>
                  item.type === 'fid_update' &&
                  item.type === 'fid_update' &&
                  item.status === 'verified',
              )
            : undefined
        if (update?.type === 'fid_update') {
          clearTimeout(timer)
          socket.offMessage(listener)
          resolve(update.status)
        }
      }
      socket.onMessage(listener)
    })
    expect(changed).toBe('verified')
    socket.close()
  })
})
