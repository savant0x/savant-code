#!/usr/bin/env bun
/**
 * SavantFree Binary Smoke Test
 *
 * Verifies the compiled SavantFree binary:
 * 1. Reports a valid version number
 * 2. Shows SavantFree branding (not SavantCode) in --help output
 * 3. Excludes mode flags (--free, --max, --plan) from --help
 * 4. Renders the SavantFree title screen (ASCII logo) in tmux
 *
 * Prerequisites:
 *   bun savant-free/cli/build.ts <version>   # build the binary
 *   brew install tmux                     # for title-screen test
 *
 * Run:
 *   bun test savant-free/cli/smoke-test.test.ts
 */

import { execFileSync, execSync, spawn, spawnSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

import { describe, test, expect, afterEach } from 'bun:test'

const REPO_ROOT = path.join(__dirname, '..', '..')
const BINARY_PATH = path.join(REPO_ROOT, 'cli', 'bin', 'savant-free')
const TIMEOUT_MS = 20_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripAnsiCodes(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

function isTmuxAvailable(): boolean {
  if (process.env.CI === 'true' || process.env.CI === '1') return false
  try {
    execSync(
      'which tmux && tmux new-session -d -s __savantFree_tmux_check__ && tmux kill-session -t __savantFree_tmux_check__',
      { stdio: 'pipe', timeout: 5000 },
    )
    return true
  } catch {
    return false
  }
}

function tmux(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('tmux', args, { stdio: 'pipe' })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`tmux failed (exit ${code}): ${stderr}`))
    })
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function runBinary(args: string[]): string {
  return execFileSync(BINARY_PATH, args, {
    encoding: 'utf-8',
    timeout: 10_000,
    env: { ...process.env, NO_COLOR: '1' },
  })
}

function runBinaryResult(args: string[]) {
  return spawnSync(BINARY_PATH, args, {
    encoding: 'utf-8',
    timeout: 10_000,
    env: {
      ...process.env,
      SAVANT_FREE_MODE: 'true',
      NO_COLOR: '1',
      NEXT_PUBLIC_CB_ENVIRONMENT: 'test',
      NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'http://127.0.0.1:9',
      NEXT_PUBLIC_SAVANT_FREE_APP_URL: 'http://127.0.0.1:9',
      NEXT_PUBLIC_SUPPORT_EMAIL: 'test@example.com',
      NEXT_PUBLIC_POSTHOG_API_KEY: 'test',
      NEXT_PUBLIC_POSTHOG_HOST_URL: 'http://127.0.0.1:9',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'test',
      NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: 'http://127.0.0.1:9',
      NEXT_PUBLIC_WEB_PORT: '3000',
    },
  })
}

const binaryExists = existsSync(BINARY_PATH)
const tmuxAvailable = isTmuxAvailable()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!binaryExists)('SavantFree Binary Smoke Tests', () => {
  test(
    '--version outputs a valid semver version',
    () => {
      const output = stripAnsiCodes(runBinary(['--version'])).trim()
      // The binary may print env info before the version; grab the last line
      const lastLine =
        output
          .split('\n')
          .filter((l) => l.trim())
          .pop() ?? ''
      expect(lastLine.trim()).toMatch(/^\d+\.\d+\.\d+/)
    },
    TIMEOUT_MS,
  )

  test(
    '--help shows SavantFree branding',
    () => {
      const output = stripAnsiCodes(runBinary(['--help']))

      // CLI name is "savant-free"
      expect(output).toContain('Usage: savant-free')
      // Description is SavantFree-specific
      expect(output).toContain('Free AI coding assistant')
      // Must NOT contain the SavantCode CLI name in the usage line
      expect(output).not.toContain('Usage: savant-code')
    },
    TIMEOUT_MS,
  )

  test(
    '--help excludes mode flags (SavantFree is free-only)',
    () => {
      const output = stripAnsiCodes(runBinary(['--help']))

      // Mode flags should not be present in SavantFree
      expect(output).not.toMatch(/--free\b/)
      expect(output).not.toMatch(/--max\b/)
      expect(output).not.toMatch(/--plan\b/)
      expect(output).not.toMatch(/--lite\b/)
    },
    TIMEOUT_MS,
  )

  test(
    'login command reaches the plain login flow',
    () => {
      const result = runBinaryResult(['login'])
      const output = stripAnsiCodes(
        `${result.stdout ?? ''}${result.stderr ?? ''}`,
      )

      // The local URL is intentionally unreachable; the smoke signal is that
      // Commander accepted `login` and the CLI entered the login flow.
      expect(result.status).not.toBe(0)
      expect(output).toContain('SavantFree Login')
      expect(output).toContain('Generating login URL')
      expect(output).not.toContain('too many arguments')
      expect(output).not.toContain('unknown command')
    },
    TIMEOUT_MS,
  )

  // -------------------------------------------------------------------------
  // tmux title-screen test
  // -------------------------------------------------------------------------

  describe.skipIf(!tmuxAvailable)('tmux title screen', () => {
    let sessionName = ''

    afterEach(async () => {
      if (sessionName) {
        try {
          await tmux(['kill-session', '-t', sessionName])
        } catch {
          // session may have already exited
        }
        sessionName = ''
      }
    })

    test(
      'displays SavantFree ASCII logo on startup',
      async () => {
        sessionName = `savant-free-smoke-${Date.now()}`

        // Start the binary in a detached tmux session
        await tmux([
          'new-session',
          '-d',
          '-s',
          sessionName,
          '-x',
          '120',
          '-y',
          '35',
          BINARY_PATH,
        ])

        // Poll until the title screen renders (ASCII art uses block chars)
        let cleanOutput = ''
        for (let attempt = 0; attempt < 20; attempt++) {
          await sleep(500)
          const raw = await tmux(['capture-pane', '-t', sessionName, '-p'])
          cleanOutput = stripAnsiCodes(raw)

          // Block characters from the ASCII logo indicate the title screen rendered
          if (cleanOutput.includes('██')) break
        }

        // Bail with a descriptive error if the title screen never appeared
        if (!cleanOutput.includes('██')) {
          throw new Error(
            `SavantFree title screen did not render within 10s. Captured output:\n${cleanOutput}`,
          )
        }

        // Verify it's the SAVANT_FREE logo, not SAVANT_CODE.
        // The SavantFree 'F' character's third line starts with the crossbar:
        //   █████╗  ██████╔╝
        // whereas SavantCode 'C' has:
        //   ██║     ██║   ██║
        // We check for the F + R pattern on line 3 of the logo.
        expect(cleanOutput).toContain('█████╗  ██████╔╝')

        // The SavantCode logo's distinctive C+O opening should NOT appear
        expect(cleanOutput).not.toContain('██╔════╝██╔═══██╗')
      },
      TIMEOUT_MS,
    )
  })
})

// Show skip messages so test output is informative
if (!binaryExists) {
  describe('SavantFree Binary Required', () => {
    test.skip('Build the binary first: bun savant-free/cli/build.ts <version>', () => {})
  })
}

if (binaryExists && !tmuxAvailable) {
  describe('tmux Required for Title Screen Test', () => {
    test.skip('Install tmux: brew install tmux (macOS) or apt-get install tmux (Linux)', () => {})
  })
}
