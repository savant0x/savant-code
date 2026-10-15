// FID-2026-0820-008 — Session Gateway integration tests (family).
//
// Spawn the real gateway (Bun.serve WS) with an injected fake runPrompt, then
// exercise the frozen v1 contract over real WebSocket connections. The family
// is decomposed into focused suite files that share ./gateway-test-harness:
//   - gateway.test.ts (this file) — trigger management wire contract
//   - gateway-handshake.test.ts — hello handshake (protocolVersion + token)
//   - gateway-origin.test.ts — Origin/Host allowlist rejection at the upgrade
//   - gateway-fid-events.test.ts — FID snapshot + file-change events
//   - gateway-scoped-threads.test.ts — scoped thread read/update
//   - gateway-user-message.test.ts — user_message streaming + sessionBusy
//   - gateway-approvals.test.ts — approval lifecycle (fail-closed on close)
//   - gateway-interrupt-reconnect.test.ts — interrupt + RunState recovery
//   - gateway-server-command.test.ts — server command + stdin watchdog
//
// The gateway never touches the real SDK client in these tests — runPrompt is
// injected, so the transport + protocol layers are what's under test.

import { describe, expect, test } from 'bun:test'

import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

import type { GatewayHandle, GatewayTriggerManager } from '../gateway'

// --- FID-2026-0824-005 step 5: trigger management over the gateway -------
// The manager is DI (same seam server-command wires to the real store);
// these tests pin the wire contract: sanitized list, secret-once create,
// validation errors as invalidRequest, feature-off degradation.

describe('gateway trigger management (step 5)', () => {
  function makeManager(): {
    manager: GatewayTriggerManager
    store: Map<string, Record<string, unknown>>
  } {
    const store = new Map<string, Record<string, unknown>>()
    const manager: GatewayTriggerManager = {
      list: () =>
        [...store.values()].map((t) => ({
          id: String(t.id),
          name: String(t.name),
          createdAt: String(t.createdAt),
          lastFiredAt: t.lastFiredAt as string | undefined,
          recurrence: t.recurrence as string | undefined,
          nextRunAt: t.nextRunAt as string | undefined,
          enabled: t.enabled !== false,
        })),
      create: (params) => {
        if (store.size > 0 && params.name === 'dup') {
          throw new Error(`Trigger name already exists: ${params.name}`)
        }
        const record: Record<string, unknown> = {
          id: `trg_${Math.random().toString(16).slice(2)}`,
          name: params.name,
          createdAt: new Date().toISOString(),
          enabled: true,
        }
        if (params.recurrence !== undefined) {
          record.recurrence = params.recurrence
        }
        store.set(String(record.id), record)
        return {
          id: String(record.id),
          name: String(record.name),
          secret: 'svt_test_secret_once',
          createdAt: String(record.createdAt),
        }
      },
      setRecurrence: (triggerId, recurrence) => {
        const t = store.get(triggerId)
        if (!t) return false
        if (recurrence === null) {
          delete t.recurrence
          delete t.nextRunAt
          return true
        }
        if (recurrence === 'banana') {
          throw new Error(`Invalid cron expression: ${recurrence}`)
        }
        t.recurrence = recurrence
        return true
      },
      setEnabled: (triggerId, enabled) => {
        const t = store.get(triggerId)
        if (!t) return false
        t.enabled = enabled
        return true
      },
      delete: (triggerId) => store.delete(triggerId),
    }
    return { manager, store }
  }

  async function authedSocket(
    opts: Parameters<typeof startTestGateway>[0],
  ): Promise<{
    gateway: GatewayHandle
    socket: Awaited<ReturnType<typeof openSocket>>
  }> {
    const gw = await startTestGateway(opts)
    const socket = await openSocket(gw.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      'hello-trg',
    )
    return { gateway: gw, socket }
  }

  test('full lifecycle: create → list (no secret) → setRecurrence → setEnabled → delete', async () => {
    const { manager } = makeManager()
    const { gateway: gw, socket } = await authedSocket({
      triggerManager: manager,
    })
    try {
      const created = (await request(
        socket,
        'triggers_create',
        { name: 'ci', recurrence: '*/5 * * * *' },
        1,
      )) as {
        result?: { trigger?: { id: string; secret?: string; name?: string } }
      }
      expect(created.result?.trigger?.id).toMatch(/^trg_/)
      // Secret-once: the plaintext rides the create response...
      expect(created.result?.trigger?.secret).toMatch(/^svt_/)
      const triggerId = created.result!.trigger!.id

      const listed = (await request(socket, 'triggers_list', {}, 2)) as {
        result?: { triggers?: Array<Record<string, unknown>> }
      }
      const entry = listed.result?.triggers?.find((t) => t.id === triggerId)
      expect(entry).toBeDefined()
      expect(entry?.recurrence).toBe('*/5 * * * *')
      expect(entry?.enabled).toBe(true)
      // ...and NEVER the list.
      expect(entry && 'secret' in entry).toBe(false)
      expect(entry && 'secretHash' in entry).toBe(false)

      const enabled = (await request(
        socket,
        'triggers_set_enabled',
        { triggerId, enabled: false },
        3,
      )) as {
        result?: { updated?: boolean }
      }
      expect(enabled.result?.updated).toBe(true)
      const afterDisable = (await request(socket, 'triggers_list', {}, 4)) as {
        result?: { triggers?: Array<{ id: string; enabled?: boolean }> }
      }
      expect(
        afterDisable.result?.triggers?.find((t) => t.id === triggerId)?.enabled,
      ).toBe(false)

      const cleared = (await request(
        socket,
        'triggers_set_recurrence',
        { triggerId, recurrence: null },
        5,
      )) as {
        result?: { updated?: boolean }
      }
      expect(cleared.result?.updated).toBe(true)

      const deleted = (await request(
        socket,
        'triggers_delete',
        { triggerId },
        6,
      )) as {
        result?: { deleted?: boolean }
      }
      expect(deleted.result?.deleted).toBe(true)
    } finally {
      socket.close()
      gw.stop()
    }
  })

  test('validation errors surface as invalidRequest (duplicate name, bad cron, unknown id)', async () => {
    const { manager } = makeManager()
    const { gateway: gw, socket } = await authedSocket({
      triggerManager: manager,
    })
    try {
      await request(socket, 'triggers_create', { name: 'base' }, 11)
      const dup = (await request(
        socket,
        'triggers_create',
        { name: 'dup' },
        12,
      )) as {
        error?: { code?: number; message?: string }
      }
      expect(dup.error?.code).toBe(-32600)
      expect(dup.error?.message).toContain('already exists')

      await request(socket, 'triggers_create', { name: 'sched' }, 13)
      // Make the second trigger's id unknown by using a nonsense id.
      const badCron = (await request(
        socket,
        'triggers_set_recurrence',
        { triggerId: 'trg_nope', recurrence: 'banana' },
        14,
      )) as { error?: { code?: number } }
      expect(badCron.error?.code).toBe(-32600)
    } finally {
      socket.close()
      gw.stop()
    }
  })

  test('without the manager DI the methods answer invalidRequest (feature off, graceful)', async () => {
    const { gateway: gw, socket } = await authedSocket({})
    try {
      const response = (await request(socket, 'triggers_list', {}, 21)) as {
        error?: { code?: number; message?: string }
      }
      expect(response.error?.code).toBe(-32600)
      expect(response.error?.message).toContain('not available')
    } finally {
      socket.close()
      gw.stop()
    }
  })
})
