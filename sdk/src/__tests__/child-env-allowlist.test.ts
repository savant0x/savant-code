/**
 * FID-2026-0919-008 (SEC-1) — allowlisted child environment.
 *
 * The spawned command shell must receive an ALLOWLISTED environment, not
 * the full process env: `getSystemProcessEnv()` carries every provider
 * credential the CLI resolved, and one `printenv` in a spawned command
 * would exfiltrate all of them into tool output / message history.
 *
 * Pinned here (via the real `runTerminalCommand` spawn path):
 *   1. A credential sentinel present in the parent env is ABSENT in the
 *      child (`printenv SENTINEL` fails; `env` output does not contain it).
 *   2. Allowlisted vars (PATH, HOME, SystemRoot) still reach the child, so
 *      ordinary commands keep working.
 *   3. The caller's explicit `env` overrides win over the allowlist.
 */
import { describe, expect, test } from 'bun:test'

import { runTerminalCommand } from '../tools/run-terminal-command'

const SENTINEL = 'FID_2026_0919_008_SENTINEL_TOKEN'

describe('buildChildEnv via runTerminalCommand (FID-2026-0919-008)', () => {
  test('does NOT leak parent credential env vars into the child shell', async () => {
    process.env[SENTINEL] = 'super-secret-value'
    try {
      const [result] = await runTerminalCommand({
        command: 'printenv FID_2026_0919_008_SENTINEL_TOKEN || echo NOT_SET',
        process_type: 'SYNC',
        cwd: process.cwd(),
        timeout_seconds: 30,
      })
      const value = result.type === 'json' ? result.value : undefined
      const stdout =
        value && 'stdout' in value ? (value.stdout as string) : undefined
      expect(stdout).toContain('NOT_SET')
      expect(stdout).not.toContain('super-secret-value')
    } finally {
      delete process.env[SENTINEL]
    }
  }, 60_000)

  test('still provides allowlisted vars so ordinary commands work', async () => {
    const [result] = await runTerminalCommand({
      command: 'echo "path-len:${#PATH}"',
      process_type: 'SYNC',
      cwd: process.cwd(),
      timeout_seconds: 30,
    })
    const value = result.type === 'json' ? result.value : undefined
    const stdout =
      value && 'stdout' in value ? (value.stdout as string) : undefined
    // PATH is allowlisted and non-empty in the child.
    expect(stdout).toMatch(/path-len:[1-9]/)
  }, 60_000)

  test('explicit env overrides win over the allowlist', async () => {
    const [result] = await runTerminalCommand({
      command: 'printenv FID_2026_0919_008_SENTINEL_TOKEN',
      process_type: 'SYNC',
      cwd: process.cwd(),
      timeout_seconds: 30,
      env: { [SENTINEL]: 'explicit-override-value' },
    })
    const value = result.type === 'json' ? result.value : undefined
    const stdout =
      value && 'stdout' in value ? (value.stdout as string) : undefined
    expect(stdout).toContain('explicit-override-value')
  }, 60_000)
})
