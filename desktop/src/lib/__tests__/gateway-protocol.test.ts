import { describe, expect, test } from 'bun:test'

import {
  GATEWAY_ERROR_CODES,
  GATEWAY_PROTOCOL_VERSION,
  helloRequest,
  parseInboundFrame,
  scopedThreadsRequest,
  scopedThreadsResultSchema,
  triggersCreateRequest,
  triggersCreateResultSchema,
  triggersDeleteRequest,
  triggersListRequest,
  triggersListResultSchema,
  triggersSetEnabledRequest,
  triggersSetRecurrenceRequest,
  triggersSetResultSchema,
  updateScopedThreadStateRequest,
  userMessageRequest,
} from '../gateway-protocol'

describe('trigger management frames (FID-2026-0824-005 step 5)', () => {
  test('triggers_list request and sanitized result parse', () => {
    const frame = triggersListRequest(7)
    expect(frame.method).toBe('triggers_list')
    const result = triggersListResultSchema.parse({
      triggers: [
        {
          id: 'trg_1',
          name: 'ci',
          createdAt: '2026-09-03T00:00:00.000Z',
          recurrence: '*/5 * * * *',
          nextRunAt: '2026-09-03T01:00:00.000Z',
          enabled: true,
        },
      ],
    })
    expect(result.triggers[0].name).toBe('ci')
    // Optional fields stay optional.
    expect(result.triggers[0].lastFiredAt).toBeUndefined()
  })

  test('triggers_create parses the secret-once response shape', () => {
    const frame = triggersCreateRequest(8, {
      name: 'deploy',
      recurrence: '0 9 * * 1-5',
    })
    expect(frame.method).toBe('triggers_create')
    expect(frame.params).toEqual({
      name: 'deploy',
      recurrence: '0 9 * * 1-5',
    })
    const parsed = triggersCreateResultSchema.parse({
      trigger: {
        id: 'trg_2',
        name: 'deploy',
        secret: 'svt_abc',
        createdAt: '2026-09-03T00:00:00.000Z',
      },
    })
    expect(parsed.trigger.secret).toBe('svt_abc')
  })

  test('set_recurrence accepts a cron string or explicit null', () => {
    expect(
      triggersSetRecurrenceRequest(9, 'trg_1', '0 3 * * *').params,
    ).toEqual({ triggerId: 'trg_1', recurrence: '0 3 * * *' })
    expect(triggersSetRecurrenceRequest(10, 'trg_1', null).params).toEqual({
      triggerId: 'trg_1',
      recurrence: null,
    })
  })

  test('set_enabled / delete frames carry exact params', () => {
    expect(triggersSetEnabledRequest(11, 'trg_1', false).params).toEqual({
      triggerId: 'trg_1',
      enabled: false,
    })
    expect(triggersDeleteRequest(12, 'trg_1').params).toEqual({
      triggerId: 'trg_1',
    })
    expect(triggersSetResultSchema.parse({ updated: true }).updated).toBe(true)
  })
})

describe('parseInboundFrame', () => {
  test('classifies an event notification carrying a PrintModeEvent batch', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'event',
      params: [{ type: 'text', text: 'hi' }],
    })
    const outcome = parseInboundFrame(raw)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok || outcome.frame.kind !== 'events') {
      throw new Error(`expected events frame, got ${JSON.stringify(outcome)}`)
    }
    expect(outcome.frame.events).toHaveLength(1)
    expect(outcome.frame.events[0].type).toBe('text')
  })

  test('degrades a non-array event params payload to unknown', () => {
    const outcome = parseInboundFrame(
      JSON.stringify({ jsonrpc: '2.0', method: 'event', params: {} }),
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('expected classified frame')
    expect(outcome.frame.kind).toBe('unknown')
  })

  test('classifies success and failure responses', () => {
    const ok = parseInboundFrame(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        result: {
          protocolVersion: 1,
          capabilities: ['hello'],
          projectId: 'repo-a',
        },
      }),
    )
    expect(ok.ok && ok.frame.kind === 'success' && ok.frame.id === 7).toBe(true)

    const bad = parseInboundFrame(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32001, message: 'no' },
      }),
    )
    expect(
      bad.ok &&
        bad.frame.kind === 'failure' &&
        bad.frame.code === -32001 &&
        bad.frame.id === null,
    ).toBe(true)
  })

  test('run_complete carries ok/error/runId fields', () => {
    const outcome = parseInboundFrame(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'run_complete',
        params: { ok: false, error: 'exploded', runId: 'r9' },
      }),
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok || outcome.frame.kind !== 'runComplete') {
      throw new Error('expected runComplete frame')
    }
    expect(outcome.frame.ok).toBe(false)
    expect(outcome.frame.error).toBe('exploded')
    expect(outcome.frame.runId).toBe('r9')
  })

  test('malformed JSON degrades to a typed outcome without throwing', () => {
    const outcome = parseInboundFrame('{nope')
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error).toContain('JSON')
  })

  test('a non-2.0 envelope reports the missing envelope', () => {
    const outcome = parseInboundFrame(
      JSON.stringify({ jsonrpc: '1.0', method: 'event', params: [] }),
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('expected classified frame')
    expect(outcome.frame.kind).toBe('unknown')
  })
})

describe('outbound builders', () => {
  test('scoped thread requests validate scope and preserve the read-only shape', () => {
    expect(scopedThreadsRequest(5, 'project', 'repo-a')).toEqual({
      jsonrpc: '2.0',
      id: 5,
      method: 'get_scoped_threads',
      params: { scopeType: 'project', scopeId: 'repo-a' },
    })
    expect(() => scopedThreadsRequest(6, 'global', '')).toThrow()
    expect(
      scopedThreadsResultSchema.parse({
        scopeType: 'global',
        scopeId: 'fleet',
        threads: [
          {
            sessionId: 'session-1',
            chatId: 'chat-1',
            agentId: 'orchestrator',
            unread: false,
            pinned: true,
            messages: [
              {
                id: 'message-1',
                role: 'user',
                content: 'hello',
                createdAt: '2026-08-25T00:00:00Z',
              },
            ],
          },
        ],
      }).threads[0]?.messages[0]?.content,
    ).toBe('hello')
  })

  test('thread state updates require a session and at least one boolean field', () => {
    expect(updateScopedThreadStateRequest(7, 's1', { pinned: true })).toEqual({
      jsonrpc: '2.0',
      id: 7,
      method: 'update_scoped_thread_state',
      params: { sessionId: 's1', pinned: true },
    })
    expect(() =>
      updateScopedThreadStateRequest(8, '', { unread: true }),
    ).toThrow()
    expect(() => updateScopedThreadStateRequest(9, 's1', {})).toThrow()
  })

  test('hello and user_message carry the frozen v1 shapes', () => {
    expect(helloRequest(1, 'tok')).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'hello',
      params: { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: 'tok' },
    })
    expect(userMessageRequest(2, 'do it')).toEqual({
      jsonrpc: '2.0',
      id: 2,
      method: 'user_message',
      params: { prompt: 'do it' },
    })
    // Fail fast on client-side contract violations.
    expect(() => helloRequest(3, '')).toThrow()
    expect(() => userMessageRequest(4, '')).toThrow()
  })

  test('mirrored error codes match the server vocabulary exactly', () => {
    expect(GATEWAY_ERROR_CODES.unauthorized).toBe(-32001)
    expect(GATEWAY_ERROR_CODES.originRejected).toBe(-32002)
    expect(GATEWAY_ERROR_CODES.unsupportedProtocolVersion).toBe(-32003)
    expect(GATEWAY_ERROR_CODES.sessionBusy).toBe(-32004)
    expect(GATEWAY_ERROR_CODES.invalidRequest).toBe(-32600)
    expect(GATEWAY_ERROR_CODES.methodNotFound).toBe(-32601)
    expect(GATEWAY_ERROR_CODES.internalError).toBe(-32603)
  })
})
