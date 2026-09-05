/**
 * EchoEnforcement steering tests (FID-2026-0805-007).
 *
 * Regression: strict-mode Law 7/8 pre-write blocks now collect corrective
 * steering text that the tool executor injects into the agent's message
 * history. These tests lock the budget contract: bounded total nudges, one
 * per law, deduped per law+file, with actionable corrective text.
 *
 * Sibling of the Loop-340 decomposition (protocol gate, refresh cadence, and
 * typed-contract suites live in enforcement-*.test.ts siblings).
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'

describe('EchoEnforcement — Law 3 re-arm on re-modification (FID-2026-0820-012)', () => {
  it('re-blocks a file that is modified again after passing verification', () => {
    const enforcement = new EchoEnforcement('hybrid')
    // Satisfy the session-init gate so the pre-write gates are exercised.
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    const path = '/proj/src/a.ts'

    // Write 1 dirties the file.
    enforcement.afterToolCall({
      toolName: 'write_file',
      input: { path },
      result: { text: 'ok' },
      writeSucceeded: true,
    })
    // A verification command credits the dirty file.
    enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run typecheck' },
      result: { text: 'ok' },
    })
    // Follow-up writes are allowed under the cumulative credit.
    const allowed = enforcement.beforeToolCall({
      toolName: 'str_replace',
      input: { path: '/proj/src/b.ts' },
      agentId: 'savant',
    })
    expect(allowed.blocked).toBe(false)

    // Re-modifying the verified file must revoke its stale credit: the
    // next write blocks again until fresh verification runs.
    enforcement.afterToolCall({
      toolName: 'str_replace',
      input: { path },
      result: { text: 'ok' },
      writeSucceeded: true,
    })
    const reblocked = enforcement.beforeToolCall({
      toolName: 'str_replace',
      input: { path: '/proj/src/c.ts' },
      agentId: 'savant',
    })
    expect(reblocked.blocked).toBe(true)
    expect(reblocked.reason).toContain('Law 3')
    expect(reblocked.reason).toContain('/proj/src/a.ts')
  })
})

describe('EchoEnforcement — pre-write steering', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function newFilePath(name: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'ehel-steering-'))
    tempDirs.push(dir)
    return join(dir, name)
  }

  /** Block a strict-mode write to a never-searched new file → Law 7. */
  function blockLaw7(enforcement: EchoEnforcement, path: string) {
    return enforcement.beforeToolCall({
      toolName: 'write_file',
      input: { path },
      agentId: 'savant',
    })
  }

  /**
   * Satisfy the FID-2026-0806-005 session-init gate so these Law 7/8
   * steering tests exercise the pre-write gates, not the protocol gate.
   */
  function clearProtocolGate(enforcement: EchoEnforcement) {
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
  }

  it('steers once with actionable Law 7 corrective text on a blocked write', () => {
    const enforcement = new EchoEnforcement('strict')
    clearProtocolGate(enforcement)
    const result = blockLaw7(enforcement, newFilePath('a.ts'))
    expect(result.blocked).toBe(true)

    const steering = enforcement.takeSteeringMessages()
    expect(steering).toHaveLength(1)
    expect(steering[0]).toContain('Law 7')
    expect(steering[0]).toMatch(/search first/i)
    expect(steering[0]).toMatch(/glob|code_search/)
  })

  it('dedupes steering per law+file (no repeat nudge for the same violation)', () => {
    const enforcement = new EchoEnforcement('strict')
    clearProtocolGate(enforcement)
    const path = newFilePath('a.ts')

    blockLaw7(enforcement, path)
    expect(enforcement.takeSteeringMessages()).toHaveLength(1)
    // Agent retries the same write without searching — blocked again, but the
    // budget already spent its one Law 7 nudge for this file.
    blockLaw7(enforcement, path)
    expect(enforcement.takeSteeringMessages()).toHaveLength(0)
  })

  it('budgets one nudge per law across different files', () => {
    const enforcement = new EchoEnforcement('strict')
    clearProtocolGate(enforcement)

    blockLaw7(enforcement, newFilePath('a.ts'))
    blockLaw7(enforcement, newFilePath('b.ts'))
    blockLaw7(enforcement, newFilePath('c.ts'))
    expect(enforcement.takeSteeringMessages()).toHaveLength(1)
  })

  it('never emits a nudge after takeSteeringMessages drains (pending cleared)', () => {
    const enforcement = new EchoEnforcement('strict')
    blockLaw7(enforcement, newFilePath('a.ts'))
    enforcement.takeSteeringMessages()
    expect(enforcement.takeSteeringMessages()).toHaveLength(0)
  })

  it('is a no-op in hybrid mode for Law 7 (strict-only advisory; protocol gate isolated)', () => {
    const enforcement = new EchoEnforcement('hybrid', { gateArmed: false })
    const result = enforcement.beforeToolCall({
      toolName: 'write_file',
      input: { path: newFilePath('a.ts') },
      agentId: 'savant',
    })
    expect(result.blocked).toBe(false)
    expect(enforcement.takeSteeringMessages()).toHaveLength(0)
  })
})
