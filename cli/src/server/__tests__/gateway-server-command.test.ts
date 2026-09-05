import { spawn } from 'node:child_process'

import { describe, expect, test } from 'bun:test'

import {
  REPO_ROOT,
  SERVER_COMMAND_PATH,
  TEST_TOKEN,
  WATCHDOG_PATH,
} from './gateway-test-harness'
import {
  GATEWAY_READY_MARKER,
  parseGatewayPort,
  PROJECT_ROOT_ENV,
  resolveServerProjectRoot,
  runServerCommand,
} from '../../server-command'
import { findGitRoot } from '../../utils/git'
import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'

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
    // skipStdinWatchdog: in-process boots must NOT arm the watchdog — its
    // end events would exit() the whole bun runner mid-suite (exit 0,
    // truncated output) whenever the harness runs with piped stdin.
    await runServerCommand({
      token: 'seed-check-token',
      port: 0,
      skipStdinWatchdog: true,
    })
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
