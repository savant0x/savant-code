// FID-2026-0820-008 — Session Gateway integration tests.
//
// Spawn the real gateway (Bun.serve WS) with an injected fake runPrompt, then
// exercise the frozen v1 contract over real WebSocket connections:
//   - hello handshake (protocolVersion + bearer token, fail-closed)
//   - bad token / wrong protocol version / non-hello-first rejection
//   - Origin/Host allowlist rejection at the upgrade
//   - user_message → accepted + streamed events + run_complete
//   - sessionBusy on a concurrent run
//   - approval lifecycle (approval_request → approval_response; fail-closed
//     deny on socket close)
//   - interrupt_stream aborts the in-flight run
//   - reconnect recovery reuses the last settled RunState
//   - stdin-close watchdog terminates the process
//
// The gateway never touches the real SDK client in these tests — runPrompt is
// injected, so the transport + protocol layers are what's under test.

import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, test } from 'bun:test'

import {
  GATEWAY_READY_MARKER,
  parseGatewayPort,
  PROJECT_ROOT_ENV,
  resolveServerProjectRoot,
  runServerCommand,
} from '../../server-command'
import { findGitRoot } from '../../utils/git'
import { EVENT_FLUSH_INTERVAL_MS, startGateway } from '../gateway'
import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'

import type { GatewayHandle } from '../gateway'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

const TEST_TOKEN = 'test-token-0123456789abcdef'
const CLEAN_ORIGIN = 'tauri://localhost'

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

// The repo root, resolved from THIS file. The file lives at
// cli/src/server/__tests__/, so the root is 4 levels up (bun test runs with
// cwd=cli/, so process.cwd() is NOT the repo root).
const REPO_ROOT = path.resolve(import.meta.dir, '..', '..', '..', '..')
const SERVER_COMMAND_PATH = path
  .join(REPO_ROOT, 'cli', 'src', 'server-command.ts')
  .replace(/\\/g, '/')
// The watchdog module is imported directly by the child script: it is a light
// standalone module, so the fresh Bun process boots fast even under full-suite
// CPU contention (the full server-command graph was blowing the poll deadline).
const WATCHDOG_PATH = path
  .join(REPO_ROOT, 'cli', 'src', 'server', 'stdin-watchdog.ts')
  .replace(/\\/g, '/')
type SocketLike = {
  send: (data: string) => void
  close: () => void
  onMessage: (listener: (event: MessageEvent) => void) => void
  offMessage: (listener: (event: MessageEvent) => void) => void
}

/** Minimal fake run state shaped like a settled RunState. */
function fakeRunState(id: string): RunState {
  return {
    traceSessionId: id,
    output: {
      type: 'lastMessage',
      value: [{ role: 'assistant', content: [] }],
    },
  } as unknown as RunState
}

/** A controllable fake runPrompt: emits canned events, waits for signals. */
function createFakeRunPrompt(opts: {
  events?: PrintModeEvent[]
  chunks?: string[]
  resultId?: string
  onStart?: (signal: AbortSignal) => void
  delayMs?: number
}) {
  const {
    events = [],
    chunks = [],
    resultId = 'run-1',
    onStart,
    delayMs = 5,
  } = opts
  return async (params: {
    prompt: string
    previousRun?: RunState
    signal: AbortSignal
    onEvent: (event: PrintModeEvent) => void
    onTextChunk: (chunk: string) => void
  }): Promise<RunState> => {
    onStart?.(params.signal)
    for (const chunk of chunks) params.onTextChunk(chunk)
    for (const event of events) params.onEvent(event)
    if (delayMs > 0)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    return fakeRunState(resultId)
  }
}

/** Open a WS client with the given origin; resolves on open. */
function openSocket(
  port: number,
  origin: string = CLEAN_ORIGIN,
): Promise<SocketLike> {
  return new Promise((resolve, reject) => {
    // Bun's WebSocket client accepts a { headers } options object at runtime;
    // the DOM lib type only exposes the protocols string[] arg, so cast.
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { origin },
    } as unknown as string[])
    const timeout = setTimeout(() => {
      try {
        ws.close()
      } catch {
        // already closed
      }
      reject(new Error('socket open timed out'))
    }, 3000)
    ws.onopen = () => {
      clearTimeout(timeout)
      resolve({
        send: (data) => ws.send(data),
        close: () => {
          try {
            ws.close()
          } catch {
            // already closed
          }
        },
        onMessage: (listener) => ws.addEventListener('message', listener),
        offMessage: (listener) => ws.removeEventListener('message', listener),
      })
    }
    ws.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('socket open failed'))
    }
  })
}

/**
 * Collect inbound frames from a socket; resolves when `until` matches. After
 * the match, keeps collecting for `settleGraceMs` (default 0) so a trailing
 * event flush (the ~50ms interval) that lands after the terminal notification
 * is captured too.
 */
function collectFrames(
  socket: SocketLike,
  until: (frame: unknown) => boolean,
  timeoutMs = 3000,
  settleGraceMs = 0,
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const frames: unknown[] = []
    let matched = false
    let settled = false
    let graceTimer: ReturnType<typeof setTimeout> | null = null
    const done = (error?: Error): void => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(frames)
    }
    const onMessage = (event: MessageEvent): void => {
      const frame = JSON.parse(String(event.data))
      frames.push(frame)
      if (!matched && until(frame)) {
        matched = true
        if (settleGraceMs > 0) {
          graceTimer = setTimeout(() => done(), settleGraceMs)
        } else {
          done()
        }
      }
    }
    const timer = setTimeout(
      () => done(new Error('collectFrames timed out')),
      timeoutMs,
    )
    const cleanup = (): void => {
      clearTimeout(timer)
      if (graceTimer) clearTimeout(graceTimer)
      socket.offMessage(onMessage)
    }
    socket.onMessage(onMessage)
  })
}

/** The test's live gateway handle, started once per suite. */
let gateway: GatewayHandle | null = null
let lastSocket: SocketLike | null = null

async function startTestGateway(
  opts: {
    runPrompt?: ReturnType<typeof createFakeRunPrompt>
    port?: number
    fidsDir?: string
  } = {},
): Promise<GatewayHandle> {
  const runPrompt =
    opts.runPrompt ??
    createFakeRunPrompt({
      events: [{ type: 'start', messageHistoryLength: 0 }],
    })
  return startGateway({
    token: TEST_TOKEN,
    port: opts.port ?? 0,
    allowedOrigins: ['tauri://localhost', 'http://tauri.localhost'],
    onReady: () => {},
    runPrompt,
    fidsDir: opts.fidsDir,
  })
}

/** Send a request frame and resolve with the single response frame. */
async function request(
  socket: SocketLike,
  method: string,
  params: unknown,
  id: number | string = 1,
): Promise<unknown> {
  const waiting = collectFrames(socket, (frame) => {
    const record = frame as { id?: unknown }
    return record.id === id
  })
  socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
  const frames = await waiting
  return frames[0]
}

afterAll(() => {
  gateway?.stop()
  lastSocket?.close()
})

describe('gateway hello handshake (frozen v1)', () => {
  test('hello with valid protocolVersion + token replies with capabilities', async () => {
    gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    lastSocket = socket
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
    gateway = await startTestGateway()
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
    gateway = await startTestGateway()
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
    gateway = await startTestGateway()
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
    gateway = await startTestGateway()
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
    gateway = await startTestGateway()
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
    gateway = await startTestGateway()
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

describe('gateway Origin/Host validation', () => {
  test('a mismatched Origin is rejected at the upgrade (403 + -32002)', async () => {
    gateway = await startTestGateway()
    const res = await probeUpgrade(gateway.port, 'https://evil.example.com')
    expect(res.status).toBe(403)
    const body = res.body as { error?: { code: number } }
    expect(body.error?.code).toBe(-32002)
  })

  test('a missing Origin is rejected at the upgrade', async () => {
    gateway = await startTestGateway()
    const res = await probeUpgrade(gateway.port)
    expect(res.status).toBe(403)
  })

  test('an allowed Origin upgrades successfully', async () => {
    gateway = await startTestGateway()
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

describe('gateway FID lifecycle events', () => {
  test('authenticated clients receive an initial FID snapshot and file changes', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'savant-fid-gateway-'))
    const fidsDir = path.join(root, 'dev', 'fids')
    mkdirSync(fidsDir, { recursive: true })
    const fidPath = path.join(fidsDir, 'FID-2026-0825-001-test.md')
    const writeFid = (status: string): void => {
      writeFileSync(
        fidPath,
        `| **ID** | FID-2026-0825-001 |\\n| **Status** | ${status} |\\n| **Severity** | low |\\n| **Parent** | FID-2026-0824-008 |\\n`,
      )
    }
    writeFid('created')
    gateway = await startTestGateway({ fidsDir })
    const socket = await openSocket(gateway.port)
    lastSocket = socket
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

describe('gateway scoped thread read', () => {
  test('returns the injected scoped thread payload through JSON-RPC', async () => {
    gateway = await startTestGateway()
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
    lastSocket = socket
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
    gateway = await startTestGateway()
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

describe('gateway user_message + event stream', () => {
  test('user_message streams text chunks as printModeText and settles with run_complete', async () => {
    const runPrompt = createFakeRunPrompt({
      chunks: ['Hello', ' world'],
      events: [
        { type: 'start', messageHistoryLength: 1 },
        {
          type: 'tool_call',
          toolCallId: 't1',
          toolName: 'read_files',
          input: { filePaths: ['a'] },
        },
        { type: 'finish', totalCost: 0.01 },
      ],
      resultId: 'run-abc',
    })
    gateway = await startTestGateway({ runPrompt })
    const socket = await openSocket(gateway.port)
    lastSocket = socket

    // Handshake first.
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )

    // user_message accepted (the accepted response resolves the request), then
    // events stream, then run_complete.
    const accepted = await request(
      socket,
      'user_message',
      { prompt: 'hi there' },
      2,
    )
    expect(accepted).toMatchObject({ result: { accepted: true } })

    // The run settles at ~5ms but events flush on the ~50ms interval, so keep
    // collecting for a few flush ticks after run_complete to capture the tail.
    const frames = await collectFrames(
      socket,
      (frame) => {
        const record = frame as { method?: string }
        return record.method === 'run_complete'
      },
      3000,
      EVENT_FLUSH_INTERVAL_MS * 3,
    )
    const eventFrames = frames.filter(
      (frame) => (frame as { method?: string }).method === 'event',
    )
    const types = eventFrames
      .map((frame) => {
        const record = frame as { params?: PrintModeEvent[] }
        return (record.params ?? []).map((e) => e.type)
      })
      .flat()

    // Text chunks coalesce into printModeText events (TokenStreamEvent →
    // printModeText mapping); structural events pass through verbatim.
    expect(types).toContain('text')
    expect(types).toContain('tool_call')
    expect(types).toContain('finish')
    const complete = frames.find(
      (frame) => (frame as { method?: string }).method === 'run_complete',
    ) as { params?: { ok: boolean; runId: string } }
    expect(complete.params?.ok).toBe(true)
    expect(complete.params?.runId).toBe('run-abc')
    socket.close()
  })

  test('a second user_message while a run is in flight gets -32004 sessionBusy', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const runPrompt = createFakeRunPrompt({
      onStart: () => {
        void gate
      },
      delayMs: 500,
    })
    // Hold the run open until we release it.
    const heldRunPrompt = async (params: {
      prompt: string
      previousRun?: RunState
      signal: AbortSignal
      onEvent: (event: PrintModeEvent) => void
      onTextChunk: (chunk: string) => void
    }): Promise<RunState> => {
      await gate
      return runPrompt(params)
    }
    gateway = await startTestGateway({ runPrompt: heldRunPrompt })
    const socket = await openSocket(gateway.port)
    lastSocket = socket
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )

    // First run starts and stays in flight.
    const firstAccepted = await request(
      socket,
      'user_message',
      { prompt: 'first' },
      2,
    )
    expect(firstAccepted).toMatchObject({ result: { accepted: true } })

    // Second run is rejected with sessionBusy.
    const busy = (await request(
      socket,
      'user_message',
      { prompt: 'second' },
      3,
    )) as {
      error?: { code: number }
    }
    expect(busy.error?.code).toBe(-32004)

    release()
    socket.close()
  })
})

describe('gateway approval lifecycle', () => {
  test('ask_user surfaces as approval_request and approval_response resolves the run', async () => {
    const runPrompt = createFakeRunPrompt({
      events: [{ type: 'start', messageHistoryLength: 0 }],
      resultId: 'run-approval',
      delayMs: 20,
    })
    gateway = await startTestGateway({ runPrompt })
    const socket = await openSocket(gateway.port)
    lastSocket = socket
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )

    // Start a run, then simulate the agent asking a question through the
    // bridge — the gateway should emit an approval_request event.
    await request(socket, 'user_message', { prompt: 'plan this' }, 2)

    // Trigger the bridge request (the AskUserBridge singleton is shared; the
    // gateway's subscriber converts it into an approval_request event).
    const { AskUserBridge } =
      await import('@savant-code/common/utils/ask-user-bridge')
    const responsePromise = AskUserBridge.request('test-tool-call', [
      {
        question: 'Approve?',
        options: [{ label: 'Yes' }, { label: 'No' }],
        multiSelect: false,
      },
    ])
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Wait for the approval_request event on the stream.
    const approvalFrame = await new Promise<{
      params?: { approvalId?: string }
    }>((resolve) => {
      const onMessage = (event: MessageEvent): void => {
        const frame = JSON.parse(String(event.data)) as {
          method?: string
          params?: unknown
        }
        if (frame.method === 'event') {
          const events = frame.params as PrintModeEvent[]
          const approval = events.find((e) => e.type === 'approval_request')
          if (approval) {
            socket.offMessage(onMessage)
            resolve({ params: { approvalId: approval.approvalId } })
          }
        }
      }
      socket.onMessage(onMessage)
    })

    // Resolve it via approval_response → the bridge promise resolves.
    await request(
      socket,
      'approval_response',
      {
        approvalId: approvalFrame.params?.approvalId,
        response: { answers: [], skipped: true },
      },
      3,
    )
    const result = await responsePromise
    expect(result).toMatchObject({ skipped: true })
    socket.close()
  })

  test('socket close denies a pending approval fail-closed (skipped recorded)', async () => {
    gateway = await startTestGateway({
      runPrompt: createFakeRunPrompt({ delayMs: 50 }),
    })
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket, 'user_message', { prompt: 'run' }, 2)

    const { AskUserBridge } =
      await import('@savant-code/common/utils/ask-user-bridge')
    const responsePromise = AskUserBridge.request('test-tool-call-2', [
      {
        question: 'Q?',
        options: [{ label: 'A' }, { label: 'B' }],
        multiSelect: false,
      },
    ])
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Closing the socket denies the pending approval fail-closed.
    socket.close()
    const result = await responsePromise
    expect(result).toMatchObject({ skipped: true, answers: [] })
  })
})

describe('gateway interrupt + reconnect recovery', () => {
  test('interrupt_stream aborts the in-flight run', async () => {
    const signalHolder: { current: AbortSignal | null } = { current: null }
    const runPrompt = createFakeRunPrompt({
      onStart: (sig) => {
        signalHolder.current = sig
      },
      delayMs: 500,
    })
    gateway = await startTestGateway({ runPrompt })
    const socket = await openSocket(gateway.port)
    lastSocket = socket
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket, 'user_message', { prompt: 'run long' }, 2)

    const interrupt = (await request(socket, 'interrupt_stream', {}, 3)) as {
      result?: { interrupting: boolean }
    }
    expect(interrupt.result?.interrupting).toBe(true)
    expect(signalHolder.current?.aborted).toBe(true)
    socket.close()
  })

  test('interrupt_stream with no run in flight is rejected', async () => {
    gateway = await startTestGateway()
    const socket = await openSocket(gateway.port)
    await request(
      socket,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    const response = (await request(socket, 'interrupt_stream', {}, 4)) as {
      error?: { code: number }
    }
    expect(response.error?.code).toBe(-32600)
    socket.close()
  })

  test('reconnect reuses the last settled RunState when no previousRun sent', async () => {
    const seenPrevious: (RunState | undefined)[] = []
    const runPrompt = async (params: {
      prompt: string
      previousRun?: RunState
      signal: AbortSignal
      onEvent: (event: PrintModeEvent) => void
      onTextChunk: (chunk: string) => void
    }): Promise<RunState> => {
      seenPrevious.push(params.previousRun)
      return fakeRunState('run-reconnect')
    }
    gateway = await startTestGateway({ runPrompt })

    // Run 1 (no previous state).
    const socket1 = await openSocket(gateway.port)
    await request(
      socket1,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket1, 'user_message', { prompt: 'first' }, 2)
    socket1.close()

    // Reconnect with a fresh socket: the gateway reuses the last RunState.
    const socket2 = await openSocket(gateway.port)
    lastSocket = socket2
    await request(
      socket2,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket2, 'user_message', { prompt: 'second' }, 2)
    socket2.close()

    expect(seenPrevious.length).toBe(2)
    expect(seenPrevious[0]).toBeUndefined()
    expect(seenPrevious[1]?.traceSessionId).toBe('run-reconnect')
  })

  test('a client-supplied previousRun wins over the in-process state', async () => {
    const seenPrevious: (RunState | undefined)[] = []
    const runPrompt = async (params: {
      prompt: string
      previousRun?: RunState
      signal: AbortSignal
      onEvent: (event: PrintModeEvent) => void
      onTextChunk: (chunk: string) => void
    }): Promise<RunState> => {
      seenPrevious.push(params.previousRun)
      return fakeRunState('run-client-state')
    }
    gateway = await startTestGateway({ runPrompt })

    // Run 1 settles, storing the in-process state.
    const socket1 = await openSocket(gateway.port)
    await request(
      socket1,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(socket1, 'user_message', { prompt: 'first' }, 2)
    socket1.close()

    // Run 2 carries an explicit previousRun — it must win.
    const socket2 = await openSocket(gateway.port)
    lastSocket = socket2
    await request(
      socket2,
      'hello',
      { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
      1,
    )
    await request(
      socket2,
      'user_message',
      { prompt: 'second', previousRun: fakeRunState('client-side-state') },
      2,
    )
    socket2.close()

    expect(seenPrevious[1]?.traceSessionId).toBe('client-side-state')
  })
})

describe('gateway server command + watchdog', () => {
  test('parseGatewayPort handles --port= and --port <n> forms', () => {
    expect(parseGatewayPort(['bun', 'cli.ts', 'server', '--port=8123'])).toBe(
      8123,
    )
    expect(
      parseGatewayPort(['bun', 'cli.ts', 'server', '--port', '8124']),
    ).toBe(8124)
    expect(parseGatewayPort(['bun', 'cli.ts', 'server'])).toBe(0)
    expect(parseGatewayPort(['bun', 'cli.ts', 'server', '--port=abc'])).toBe(0)
    expect(parseGatewayPort(['bun', 'cli.ts', 'server', '--port=99999'])).toBe(
      0,
    )
  })

  test('resolveServerProjectRoot prefers the env override, then git root, then cwd', () => {
    // Env override (trimmed) wins — env-only delivery mirrors GATEWAY_TOKEN_ENV.
    expect(
      resolveServerProjectRoot({ [PROJECT_ROOT_ENV]: '  /tmp/repo  ' }),
    ).toBe('/tmp/repo')
    // FID-2026-0901-004: blank/absent override anchors to the GIT ROOT of the
    // launch dir — the desktop sidecar must operate on the real project, not
    // whatever subdirectory the binary happened to launch from (dev launches
    // from desktop/src-tauri).
    const gitRoot = findGitRoot({ cwd: process.cwd() })
    if (gitRoot !== null) {
      expect(resolveServerProjectRoot({ [PROJECT_ROOT_ENV]: '   ' })).toBe(
        gitRoot,
      )
      expect(resolveServerProjectRoot({})).toBe(gitRoot)
    } else {
      // No enclosing repo: launch directory remains the fallback.
      expect(resolveServerProjectRoot({})).toBe(process.cwd())
    }
  })

  test('runServerCommand seeds project root before the gateway starts', async () => {
    // Regression: server mode never called setProjectRoot, so every gateway
    // run died with 'Project root not set' (project-files.ts getProjectRoot).
    // FID-2026-0901-004: the seed is the RESOLVED root (git root when the
    // launch dir lives inside a repo), not raw process.cwd().
    const { tryGetProjectRoot } = await import('../../project-files')
    await runServerCommand({ token: 'seed-check-token', port: 0 })
    expect(tryGetProjectRoot()).toBe(resolveServerProjectRoot())
  })

  test('installStdinWatchdog exits on stdin close (parent-death path)', async () => {
    // Spawn a child that installs the watchdog and stays alive, then close the
    // parent's stdin pipe — the child must self-terminate via the watchdog.
    // (The parent-death path on Windows: the supervisor dies, its pipe closes.)
    const script =
      'import { installStdinWatchdog } from "' +
      WATCHDOG_PATH +
      '"; ' +
      'installStdinWatchdog(() => process.exit(0)); ' +
      'console.error("WATCHDOG_ARMED"); ' +
      'setInterval(() => {}, 1000); '
    const child = spawn('bun', ['-e', script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: REPO_ROOT,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += String(d)))
    child.stderr.on('data', (d) => (stderr += String(d)))

    // Poll for the armed marker, then close the parent's stdin pipe. On
    // deadline the captured child output is surfaced in the failure so the
    // boot state is diagnosable instead of an opaque timeout.
    const armed = await new Promise<boolean>((resolve, reject) => {
      const started = Date.now()
      const poll = setInterval(() => {
        if (stderr.includes('WATCHDOG_ARMED')) {
          clearInterval(poll)
          resolve(true)
        } else if (Date.now() - started > 25000) {
          clearInterval(poll)
          reject(
            new Error(
              'child never printed WATCHDOG_ARMED within 25s\n' +
                `--- stderr tail ---\n${stderr.slice(-2000)}\n` +
                `--- stdout tail ---\n${stdout.slice(-2000)}`,
            ),
          )
        }
      }, 100)
    })
    expect(armed).toBe(true)
    child.stdin.end()
    const exitCode = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 10000)
      child.on('exit', (code) => {
        clearTimeout(timer)
        resolve(code)
      })
    })
    expect(exitCode).not.toBeNull()
    expect(exitCode === 0).toBe(true)
  }, 60000)

  test('runServerCommand fails closed without a token', async () => {
    const originalExit = process.exit
    let exitCode: number | null = null
    ;(process as unknown as { exit: (code?: number) => never }).exit = ((
      code?: number,
    ) => {
      exitCode = code ?? 0
      throw new Error('exit')
    }) as (code?: number) => never
    try {
      await runServerCommand({ token: '', port: 0 })
    } catch {
      // expected exit
    } finally {
      ;(process as unknown as { exit: (code?: number) => never }).exit =
        originalExit as unknown as (code?: number) => never
    }
    expect(exitCode === 2).toBe(true)
  })

  test('runServerCommand prints the ready line with the bound port', async () => {
    // Run the real command in a child with a token; parse the ready line.
    const script =
      'import { runServerCommand } from "' +
      SERVER_COMMAND_PATH +
      '"; ' +
      'runServerCommand({ token: "' +
      TEST_TOKEN +
      '", port: 0 }); ' +
      'setInterval(() => {}, 1000); '
    const child = spawn('bun', ['-e', script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: REPO_ROOT,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += String(d)))
    child.stderr.on('data', (d) => (stderr += String(d)))

    // Poll for the marker line (the child boots slowly under the test
    // runner). On deadline the captured child output is surfaced in the
    // failure so the boot state is diagnosable instead of an opaque timeout.
    const readyLine = await new Promise<string>((resolve, reject) => {
      const started = Date.now()
      const poll = setInterval(() => {
        const line = stdout
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.includes(GATEWAY_READY_MARKER))
        if (line) {
          clearInterval(poll)
          resolve(line)
        } else if (child.exitCode !== null || child.signalCode !== null) {
          clearInterval(poll)
          reject(
            new Error(
              `gateway child exited before printing the ready line (code=${String(child.exitCode)} signal=${String(child.signalCode)})\n` +
                `--- stderr ---\n${stderr}\n--- stdout ---\n${stdout}`,
            ),
          )
        } else if (Date.now() - started > 50000) {
          clearInterval(poll)
          reject(
            new Error(
              'child never printed the gateway ready line within 50s\n' +
                `--- stdout tail ---\n${stdout.slice(-2000)}\n` +
                `--- stderr tail ---\n${stderr.slice(-2000)}`,
            ),
          )
        }
      }, 100)
    })
    child.kill()
    // The cli env init prints a banner to stdout before the ready line; the
    // supervisor contract is the marker line (see GATEWAY_READY_MARKER).
    expect(readyLine).toBeDefined()
    const ready = JSON.parse(readyLine as string) as {
      marker?: string
      port?: number
      protocolVersion?: number
    }
    expect(ready.marker).toBe(GATEWAY_READY_MARKER)
    expect(typeof ready.port).toBe('number')
    expect(ready.protocolVersion).toBe(GATEWAY_PROTOCOL_VERSION)
  }, 90000)
})
