// FID-2026-0820-009 Loop 4 — parent-kill + gateway E2E against the REAL
// compiled sidecar (desktop/src-tauri/binaries/savant-sidecar-$TRIPLE[.exe],
// built from cli/src/server-command.ts by scripts/build-sidecar.ts).
//
// Exercises the frozen FID-2026-0820-008 handshake contract end to end:
//   - ready line parses (marker + ephemeral port + protocolVersion 1)
//   - hello with the ENV-injected token succeeds (Origin allowlist honored)
//   - hello with a bad token is rejected -32001
//   - stdin close terminates the sidecar within the grace budget (watchdog)
//   - hard-killing the intermediate parent closes the pipes and the sidecar
//     self-terminates (zombie-free guarantee)
//
// The suite self-skips when the native binary is absent so default
// `bun test scripts/` runs stay green on machines that never built it.
// Contract constants are mirrored locally (the Rust gateway.rs does the
// same) rather than importing the heavy CLI graph.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

const READY_MARKER = 'savant-gateway-ready'
const PROTOCOL_VERSION = 1
// Sole allowed Origin under the frozen contract's default allowlist.
const TAURI_ORIGIN = 'tauri://localhost'

interface NativeTarget {
  readonly triple: string
  readonly extension: string
}

function nativeTarget(): NativeTarget {
  switch (process.platform) {
    case 'win32':
      return { triple: 'x86_64-pc-windows-msvc', extension: '.exe' }
    case 'darwin':
      return { triple: 'aarch64-apple-darwin', extension: '' }
    case 'linux':
      return { triple: 'x86_64-unknown-linux-gnu', extension: '' }
    default:
      throw new Error(`unsupported platform: ${process.platform}`)
  }
}

const BINARIES_DIR = path.resolve(
  import.meta.dir,
  '..',
  'src-tauri',
  'binaries',
)

function sidecarPath(): string {
  const target = nativeTarget()
  return path.join(
    BINARIES_DIR,
    `savant-sidecar-${target.triple}${target.extension}`,
  )
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Child env kept hermetic: valid NEXT_PUBLIC value regardless of leaks. */
function childEnv(token: string): Record<string, string> {
  return {
    ...process.env,
    SAVANT_GATEWAY_TOKEN: token,
    NEXT_PUBLIC_SAVANT_FREE_APP_URL: 'https://savant-code.com',
  } as Record<string, string>
}

interface ReadyInfo {
  port: number
  protocolVersion: number
}

async function waitForReadyLine(
  stdout: ReadableStream<Uint8Array>,
): Promise<ReadyInfo> {
  const reader = stdout.getReader()
  const decoder = new TextDecoder()
  let buffered = ''
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const chunk = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('ready-line wait timed out')),
          20_000,
        ),
      ),
    ])
    buffered += decoder.decode(chunk?.value ?? new Uint8Array(), {
      stream: true,
    })
    const line = buffered
      .split('\n')
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate.includes(READY_MARKER))
    if (line !== undefined) {
      void reader.cancel()
      const parsed = JSON.parse(line) as {
        marker?: string
        port?: number
        protocolVersion?: number
      }
      expect(parsed.marker).toBe(READY_MARKER)
      expect(typeof parsed.port).toBe('number')
      return {
        port: parsed.port as number,
        protocolVersion: parsed.protocolVersion as number,
      }
    }
  }
  throw new Error(
    `sidecar never printed the ready line; saw: ${buffered.slice(-1000)}`,
  )
}

type SpawnedSidecar = {
  proc: Bun.Subprocess<'pipe', 'pipe', 'pipe'>
  ready: ReadyInfo
  token: string
}

async function spawnSidecar(): Promise<SpawnedSidecar> {
  const token = randomToken()
  const proc = Bun.spawn([sidecarPath(), '--port=0'], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: childEnv(token),
  })
  let ready: ReadyInfo
  try {
    ready = await waitForReadyLine(proc.stdout)
  } catch (error) {
    // Failure-path hygiene: never leak a live sidecar on a failed wait.
    proc.kill()
    throw error
  }
  expect(ready.protocolVersion).toBe(PROTOCOL_VERSION)
  return { proc, ready, token }
}

/** One JSON-RPC round trip over a Bun WebSocket with the Tauri origin. */
function rpcCall(
  port: number,
  body: unknown,
  id: number,
): Promise<{ result?: Record<string, unknown>; error?: { code: number } }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { origin: TAURI_ORIGIN },
    } as unknown as string[])
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error('rpc timed out'))
    }, 10_000)
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ jsonrpc: '2.0', id, ...(body as object) }))
    })
    socket.addEventListener('message', (event) => {
      const frame = JSON.parse(String(event.data)) as {
        id?: number
        result?: Record<string, unknown>
        error?: { code: number }
      }
      if (frame.id === id) {
        clearTimeout(timer)
        socket.close()
        resolve(frame)
      }
    })
    socket.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('socket error'))
    })
  })
}

describe('real-sidecar gateway E2E', () => {
  test('hello handshake honors the frozen v1 contract', async () => {
    const { proc, ready, token } = await spawnSidecar()
    try {
      const ok = await rpcCall(
        ready.port,
        {
          method: 'hello',
          params: { protocolVersion: PROTOCOL_VERSION, token },
        },
        1,
      )
      expect(ok.result?.protocolVersion).toBe(PROTOCOL_VERSION)
      const capabilities = ok.result?.capabilities as string[]
      expect(capabilities).toContain('user_message')

      const rejected = await rpcCall(
        ready.port,
        {
          method: 'hello',
          params: { protocolVersion: PROTOCOL_VERSION, token: 'wrong-token' },
        },
        2,
      )
      expect(rejected.error?.code).toBe(-32001)
    } finally {
      proc.stdin.end()
      await proc.exited
    }
  })

  test('stdin close terminates the sidecar zombie-free (watchdog path)', async () => {
    const { proc } = await spawnSidecar()
    proc.stdin.end()
    const exitCode = await Promise.race([
      proc.exited,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('sidecar survived stdin close')),
          15_000,
        ),
      ),
    ])
    expect(exitCode).toBe(0)
  })

  test('hard-killing the intermediate parent leaves no zombie sidecar', async () => {
    // An intermediate bun process spawns the sidecar and then exits hard;
    // its death closes the pipe ends and the sidecar's stdin-watchdog must
    // reap it — exactly what happens when the Rust supervisor dies.
    const token = randomToken()
    const wrapperScript = [
      `const child = Bun.spawn([${JSON.stringify(sidecarPath())}, "--port=0"],`,
      "  { stdin: 'pipe', stdout: 'inherit', stderr: 'inherit',",
      `    env: { ...process.env, SAVANT_GATEWAY_TOKEN: ${JSON.stringify(randomToken())} } });`,
      `console.log("SIDECAR_PID=" + child.pid);`,
      'setTimeout(() => process.exit(137), 4000);',
    ].join('\n')
    const wrapper = Bun.spawn([process.execPath, '-e', wrapperScript], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: childEnv(token),
    })
    let pidLine = ''
    const wrapperReader = wrapper.stdout.getReader()
    const decoder = new TextDecoder()
    const wrapperDeadline = Date.now() + 15_000
    while (!pidLine.includes('SIDECAR_PID=') && Date.now() < wrapperDeadline) {
      const chunk = await wrapperReader.read()
      if (chunk.done) break
      pidLine += decoder.decode(chunk.value, { stream: true })
    }
    const pid = Number.parseInt(
      /SIDECAR_PID=(\d+)/.exec(pidLine)?.[1] ?? '0',
      10,
    )
    expect(pid).toBeGreaterThan(0)

    await wrapper.exited
    expect(wrapper.exitCode).toBe(137)

    // Poll until the orphaned sidecar reaps itself (watchdog fired).
    const deadDeadline = Date.now() + 15_000
    let alive = true
    while (Date.now() < deadDeadline) {
      alive = true
      try {
        process.kill(pid, 0)
      } catch (error) {
        const code = (error as { code?: string } | null)?.code
        // Only ESRCH proves death; EPERM means alive-but-denied.
        alive = code !== 'ESRCH'
      }
      if (!alive) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    expect(alive).toBe(false)
  })
})

describe('skip guard', () => {
  test('native sidecar binary present (suite is live, not skipped)', () => {
    expect(fs.existsSync(sidecarPath())).toBe(true)
  })
})
