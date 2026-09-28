import { spawn, spawnSync } from 'child_process'
import path from 'path'

import { describe, test, expect } from 'bun:test'
import stripAnsi from 'strip-ansi'

import { isSDKBuilt, ensureCliTestEnv } from './test-utils'

const CLI_PATH = path.join(__dirname, '../index.tsx')
/**
 * Kill budget for a CLI child that should answer `--help` instantly.
 *
 * FID-2026-0927-002 F4: this was 10_000, which is the value the named 10s
 * flake actually died on — NOT the per-test budget. Re-running the file under
 * 3x CPU contention (48 spinners on 16 cores) reproduced 5 failures, every one
 * `Expected to contain: "--agent" / Received: ""` at 10.3-11.6s. `Received: ""`
 * is the fingerprint of a spawn killed mid-boot: `spawnSync` SIGTERMs the child,
 * `result.stdout` is `undefined`, `?? ''` makes it `""`. A child that needs
 * >10s to answer `--help` under load is not hung, it is contended — so the
 * budget must clear contended boot, not just an idle one.
 *
 * 45s is the upper of the two candidates: it still bounds a genuine hang far
 * inside the suite runtime, while giving ~20x headroom over the observed 1.4-2.2s
 * idle and ~4x over the ~10.5s measured at 3x contention. Raising the PER-TEST
 * budget alone was already proven insufficient — those tests had 60s of room
 * and still died in here, where the per-test budget has no jurisdiction.
 */
const SPAWN_KILL_MS = 45000
/**
 * Per-test budget. Deliberately separate from the spawn kill budget: reusing
 * one constant gave these cases exactly bun's 10s default, so the observed
 * 1.4-2.2s runs had only ~5x headroom and could cross the line on a loaded
 * machine (a 13-workspace typecheck chain + repo-wide eslint + this suite).
 * 60s matches `terminal-watchdog.test.ts` and still bounds a genuine hang far
 * inside the suite's ~2 minute runtime. Passed per-test because that is the
 * only mechanism bun 1.3.14 honours — a `[test] timeout` in `cli/bunfig.toml`
 * was proven inert by mutation.
 */
const E2E_TEST_TIMEOUT = 60000
const sdkBuilt = isSDKBuilt()
const BUN = process.execPath

ensureCliTestEnv()

function runCLI(args: string[]): {
  stdout: string
  stderr: string
  exitCode: number | null
} {
  const result = spawnSync(BUN, ['run', CLI_PATH, ...args], {
    cwd: path.join(__dirname, '../..'),
    timeout: SPAWN_KILL_MS,
    env: process.env,
  })
  return {
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
    exitCode: result.status,
  }
}

describe.skipIf(!sdkBuilt)('CLI End-to-End Tests', () => {
  test(
    'CLI shows help with --help flag',
    () => {
      const { stdout, stderr, exitCode } = runCLI(['--help'])

      const cleanOutput = stripAnsi(stdout + stderr)
      expect(cleanOutput).toContain('--agent')
      expect(cleanOutput).toContain('Usage:')
      expect(exitCode).toBe(0)
    },
    E2E_TEST_TIMEOUT,
  )

  test(
    'CLI shows help with -h flag',
    () => {
      const { stdout, stderr, exitCode } = runCLI(['-h'])

      const cleanOutput = stripAnsi(stdout + stderr)
      expect(cleanOutput).toContain('--agent')
      expect(exitCode).toBe(0)
    },
    E2E_TEST_TIMEOUT,
  )

  test(
    'CLI shows version with --version flag',
    () => {
      const { stdout, stderr, exitCode } = runCLI(['--version'])

      const cleanOutput = stripAnsi(stdout + stderr)
      expect(cleanOutput).toMatch(/\d+\.\d+\.\d+|dev/)
      expect(exitCode).toBe(0)
    },
    E2E_TEST_TIMEOUT,
  )

  test(
    'CLI shows version with -v flag',
    () => {
      const { stdout, stderr, exitCode } = runCLI(['-v'])

      const cleanOutput = stripAnsi(stdout + stderr)
      expect(cleanOutput).toMatch(/\d+\.\d+\.\d+|dev/)
      expect(exitCode).toBe(0)
    },
    E2E_TEST_TIMEOUT,
  )

  test(
    'CLI accepts --agent flag',
    async () => {
      // Verify the CLI starts without errors when given --agent flag.
      // The CLI goes through full initialization (agent registry, skill registry,
      // renderer creation) before producing any piped output, so we need a
      // generous timeout. We also treat "process still alive" as success.
      const proc = spawn(BUN, ['run', CLI_PATH, '--agent', 'ask'], {
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe',
      })

      let started = false
      let exitedEarly = false
      proc.once('exit', () => {
        if (!started) exitedEarly = true
      })

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Process is still alive after wait — it started successfully
          if (!exitedEarly) started = true
          resolve()
        }, 8000)

        proc.stdout?.once('data', () => {
          started = true
          clearTimeout(timeout)
          resolve()
        })
        proc.stderr?.once('data', () => {
          started = true
          clearTimeout(timeout)
          resolve()
        })
      })

      proc.kill('SIGTERM')

      expect(started).toBe(true)
    },
    E2E_TEST_TIMEOUT,
  )

  test(
    'CLI accepts --clear-logs flag',
    async () => {
      const proc = spawn(BUN, ['run', CLI_PATH, '--clear-logs'], {
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe',
      })

      let started = false
      let exitedEarly = false
      proc.once('exit', () => {
        if (!started) exitedEarly = true
      })

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!exitedEarly) started = true
          resolve()
        }, 8000)

        proc.stdout?.once('data', () => {
          started = true
          clearTimeout(timeout)
          resolve()
        })
        proc.stderr?.once('data', () => {
          started = true
          clearTimeout(timeout)
          resolve()
        })
      })

      proc.kill('SIGTERM')

      expect(started).toBe(true)
    },
    E2E_TEST_TIMEOUT,
  )

  test(
    'CLI handles invalid flags gracefully',
    () => {
      const { stderr, exitCode } = runCLI(['--invalid-flag'])

      // Commander should show an error
      expect(exitCode).not.toBe(0)
      expect(stripAnsi(stderr)).toContain('error')
    },
    E2E_TEST_TIMEOUT,
  )
})

// Show message when SDK tests are skipped
if (!sdkBuilt) {
  describe('SDK Build Required', () => {
    test.skip('Build SDK for E2E tests: cd sdk && bun run build', () => {
      // This test is skipped to show the build instruction
    })
  })
}
