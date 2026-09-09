// FID-2026-0907-007 — shared harness for the 6-case NDJSON handoff matrix
// (BO Phase 3 FID 5): spawn the ACTUAL CLI child against a deterministic
// local fake OpenAI-compatible gateway and drive its stdin, asserting the
// frozen wire contract end to end (argv parsing, child env, stdin framing,
// stdout purity — surfaces the in-process DI suites cannot prove).
//
// Determinism seam: INFERENCE_BASE_URL direct-mode routing + a bare-slug
// model preference in a temp config dir route the child's inference to the
// local gateway (proven by model-provider-free-mode-bare-slug.test.ts).
//
// Split (300-line ceiling): cases 1-3 live in handoff-matrix.test.ts, cases
// 4-6 in handoff-matrix-part-b.test.ts; both drive this harness.
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const PLAIN_ANSWER = 'HANDOFF MATRIX ANSWER'
export const MULTILINE_ANSWER = 'line one\n"quoted" middle line\ttabbed end'
export const CASE_TIMEOUT = 120_000

export type GatewayMode =
  'tool-then-answer' | 'plain' | 'newline' | 'hold' | 'error500'

export const gateway: { mode: GatewayMode; requestCount: number } = {
  mode: 'plain',
  requestCount: 0,
}

const BUN = process.execPath
const CLI_PATH = path.join(__dirname, '../index.tsx')

function chunk(delta: Record<string, unknown>, finish: string | null): string {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-matrix',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'local-matrix-model',
    choices: [{ index: 0, delta, finish_reason: finish }],
  })}\n\n`
}

function completionBody(content: string): string {
  return (
    chunk({ role: 'assistant', content }, null) +
    chunk({}, 'stop') +
    'data: [DONE]\n\n'
  )
}

const TOOL_CALL_ARGS = '{"path":"."}'

function toolCallBody(): string {
  return (
    chunk(
      {
        role: 'assistant',
        tool_calls: [
          {
            index: 0,
            id: 'call_matrix_1',
            type: 'function',
            function: { name: 'list_directory', arguments: TOOL_CALL_ARGS },
          },
        ],
      },
      null,
    ) +
    chunk({}, 'tool_calls') +
    'data: [DONE]\n\n'
  )
}

let server: ReturnType<typeof Bun.serve> | undefined
let port = 0
let configDir = ''
let running = false

export function startMatrixGateway(): void {
  // Reentrancy guard (FID-007 Loop 3 audit): part-a and part-b both
  // start/stop this module-singleton gateway inside one bun test process;
  // idempotency keeps a second start from orphaning the first server
  // (and a second stop from double-freeing the temp config dir).
  if (running) return
  running = true
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-matrix-cfg-'))
  fs.writeFileSync(
    path.join(configDir, 'settings.json'),
    JSON.stringify({ savantCodeModelPreference: 'local-matrix-model' }),
  )
  server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      if (
        req.method !== 'POST' ||
        !url.pathname.endsWith('/chat/completions')
      ) {
        return new Response('not found', { status: 404 })
      }
      gateway.requestCount++
      if (gateway.mode === 'error500') {
        return new Response(
          JSON.stringify({
            error: { message: 'gateway exploded', type: 'server_error' },
          }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        )
      }
      if (
        gateway.mode === 'tool-then-answer' &&
        gateway.requestCount % 2 === 1
      ) {
        return new Response(toolCallBody(), {
          headers: { 'content-type': 'text/event-stream' },
        })
      }
      if (gateway.mode === 'hold') {
        // Case 4 seam: emit a text delta, then keep the SSE stream open with
        // periodic deltas and never send [DONE] — the request stays in
        // flight, so the parent's cancel frame exercises the ARRIVAL-time
        // abort (headless-control-plane.ts onCancel) instead of racing a
        // completion that never comes.
        const encoder = new TextEncoder()
        let interval: ReturnType<typeof setInterval> | undefined
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                chunk({ role: 'assistant', content: 'hold' }, null),
              ),
            )
            let tick = 0
            interval = setInterval(() => {
              tick += 1
              try {
                controller.enqueue(
                  encoder.encode(chunk({ content: `hold tick ${tick}` }, null)),
                )
              } catch {
                // stream closed by the aborted child request
                if (interval) clearInterval(interval)
              }
            }, 1000)
          },
          cancel() {
            if (interval) clearInterval(interval)
          },
        })
        return new Response(stream, {
          headers: { 'content-type': 'text/event-stream' },
        })
      }
      const content =
        gateway.mode === 'newline' ? MULTILINE_ANSWER : PLAIN_ANSWER
      return new Response(completionBody(content), {
        headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  const bound = server.port
  if (bound === undefined) {
    throw new Error('handoff-matrix gateway failed to bind an ephemeral port')
  }
  port = bound
}

export function stopMatrixGateway(): void {
  if (!running) return
  running = false
  server?.stop(true)
  fs.rmSync(configDir, { recursive: true, force: true })
  server = undefined
}

export type Child = ReturnType<typeof spawn> & {
  stdin: NonNullable<ReturnType<typeof spawn>['stdin']>
  stdout: NonNullable<ReturnType<typeof spawn>['stdout']>
  stderr: NonNullable<ReturnType<typeof spawn>['stderr']>
}

export function spawnChild(brief: string, jsonMode: boolean): Child {
  const args = [
    'run',
    CLI_PATH,
    '--print',
    ...(jsonMode ? ['--json'] : []),
    brief,
  ]
  const child = spawn(BUN, args, {
    cwd: path.join(__dirname, '../..'),
    env: {
      ...process.env,
      SAVANT_CODE_CONFIG_DIR: configDir,
      INFERENCE_BASE_URL: `http://127.0.0.1:${port}/v1`,
      INFERENCE_API_KEY: 'matrix-dummy-key',
      SAVANT_CODE_RUN_TIMEOUT_MS: '90000',
      CI: 'true',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  return child as Child
}

export type RunResult = {
  code: number | null
  stdout: string
  stderr: string
  elapsedMs: number
}

export function runAndCollect(child: Child): Promise<RunResult> {
  const started = Date.now()
  let stdoutBuf = ''
  const stderrChunks: string[] = []
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (c: string) => {
    stdoutBuf += c
  })
  child.stderr.on('data', (c: string) => {
    stderrChunks.push(c)
  })
  return new Promise((resolve) => {
    child.on('close', (code) => {
      resolve({
        code,
        stdout: stdoutBuf,
        stderr: stderrChunks.join(''),
        elapsedMs: Date.now() - started,
      })
    })
  })
}

export function jsonLines(stdout: string): unknown[] {
  return stdout
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

export type Frame = {
  v: number
  type: string
  ts: number
  data?: Record<string, unknown>
}

export function framesOfType(stdout: string, type: string): Frame[] {
  return jsonLines(stdout).filter(
    (frame): frame is Frame =>
      typeof frame === 'object' &&
      frame !== null &&
      (frame as Frame).type === type,
  )
}
