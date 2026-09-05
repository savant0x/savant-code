// FID-2026-0820-008 — Session Gateway integration test harness.
//
// Shared fixtures for the gateway test family (see gateway.test.ts for the
// family header): the fake runPrompt factory, real-WebSocket client helpers,
// frame collection, and the startTestGateway boot every suite uses. Each suite
// file owns its own gateway/socket module state plus its own afterAll
// teardown — this module stays stateless.
//
// The gateway never touches the real SDK client in these tests — runPrompt is
// injected, so the transport + protocol layers are what's under test.

import path from 'node:path'

import { startGateway } from '../gateway'

import type { GatewayHandle, GatewayTriggerManager } from '../gateway'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

export const TEST_TOKEN = 'test-token-0123456789abcdef'
export const CLEAN_ORIGIN = 'tauri://localhost'

// The repo root, resolved from THIS file. The file lives at
// cli/src/server/__tests__/, so the root is 4 levels up (bun test runs with
// cwd=cli/, so process.cwd() is NOT the repo root).
export const REPO_ROOT = path.resolve(import.meta.dir, '..', '..', '..', '..')
export const SERVER_COMMAND_PATH = path
  .join(REPO_ROOT, 'cli', 'src', 'server-command.ts')
  .replace(/\\/g, '/')
// The watchdog module is imported directly by the child script: it is a light
// standalone module, so the fresh Bun process boots fast even under full-suite
// CPU contention (the full server-command graph was blowing the poll deadline).
export const WATCHDOG_PATH = path
  .join(REPO_ROOT, 'cli', 'src', 'server', 'stdin-watchdog.ts')
  .replace(/\\/g, '/')

export type SocketLike = {
  send: (data: string) => void
  close: () => void
  onMessage: (listener: (event: MessageEvent) => void) => void
  offMessage: (listener: (event: MessageEvent) => void) => void
}

/** Minimal fake run state shaped like a settled RunState. */
export function fakeRunState(id: string): RunState {
  return {
    traceSessionId: id,
    output: {
      type: 'lastMessage',
      value: [{ role: 'assistant', content: [] }],
    },
  } as unknown as RunState
}

/** A controllable fake runPrompt: emits canned events, waits for signals. */
export function createFakeRunPrompt(opts: {
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
export function openSocket(
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
export function collectFrames(
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

/** Send a request frame and resolve with the single response frame. */
export async function request(
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
  // Return the id-matched frame, not merely the first frame received: a
  // server-initiated notification (e.g. the post-hello FID snapshot,
  // gateway.ts handleHello setTimeout-0) can interleave into the collect
  // window when the suite runs from a cwd where <cwd>/dev/fids exists (the
  // repo root — the fid:verify gate runner). FID-2026-0905-004 RED finding 5.
  return frames.find((frame) => (frame as { id?: unknown }).id === id)
}

export async function startTestGateway(
  opts: {
    runPrompt?: ReturnType<typeof createFakeRunPrompt>
    port?: number
    fidsDir?: string
    triggerManager?: GatewayTriggerManager
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
    triggerManager: opts.triggerManager,
  })
}
