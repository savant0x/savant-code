/**
 * EchoEnforcement steering tests (FID-2026-0805-007).
 *
 * Regression: strict-mode Law 7/8 pre-write blocks now collect corrective
 * steering text that the tool executor injects into the agent's message
 * history. These tests lock the budget contract: bounded total nudges, one
 * per law, deduped per law+file, with actionable corrective text.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import {
  EchoEnforcement,
  getOrCreateEnforcement,
  resolveEnforcementMode,
} from '../enforcement'

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

describe('EchoEnforcement — session-init protocol gate (FID-2026-0806-005)', () => {
  it('blocks non-read tools before the protocol file is read (strict)', () => {
    const enforcement = new EchoEnforcement('strict')
    const result = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('ECHO.md')
  })

  it('allows read-only context tools and ask_user/write_todos pre-read', () => {
    const enforcement = new EchoEnforcement('strict')
    for (const toolName of [
      'read_files',
      'read_subtree',
      'ask_user',
      'write_todos',
    ] as const) {
      const result = enforcement.beforeToolCall({
        toolName,
        input: toolName === 'read_files' ? { paths: ['src/a.ts'] } : {},
        agentId: 'savant',
      })
      expect(result.blocked).toBe(false)
    }
  })

  it('clears the gate when a read targets the protocol file', () => {
    const enforcement = new EchoEnforcement('strict')
    const blockedGlob = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(blockedGlob.blocked).toBe(true)

    const read = enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    expect(read.blocked).toBe(false)

    const allowedGlob = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(allowedGlob.blocked).toBe(false)
  })

  it('does not accept a same-basename protocol file in another directory', () => {
    const enforcement = new EchoEnforcement('strict', {
      protocolFile: 'docs/ECHO.md',
    })
    const wrongRead = enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['other/ECHO.md'] },
      agentId: 'savant',
    })
    expect(wrongRead.blocked).toBe(false)
    const blockedGlob = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(blockedGlob.blocked).toBe(true)
  })

  it('matches a nested protocol path and a configured protocol file', () => {
    const enforcement = new EchoEnforcement('strict', {
      protocolFile: 'docs/ECHO.md',
    })
    const read = enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['docs/ECHO.md'] },
      agentId: 'savant',
    })
    expect(read.blocked).toBe(false)
    const glob = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(glob.blocked).toBe(false)
  })

  it('is no longer a no-op in hybrid mode (universal gate, FID-2026-0810-002)', () => {
    const enforcement = new EchoEnforcement('hybrid')
    const result = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('ECHO.md')
  })

  it('honors gateArmed:false as the legacy no-gate contract (SDK embedders)', () => {
    const enforcement = new EchoEnforcement('hybrid', { gateArmed: false })
    const result = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(result.blocked).toBe(false)
  })

  it('clears the universal gate when a read targets the protocol file (hybrid)', () => {
    const enforcement = new EchoEnforcement('hybrid')
    expect(
      enforcement.beforeToolCall({
        toolName: 'glob',
        input: { pattern: '**/*.ts' },
        agentId: 'savant',
      }).blocked,
    ).toBe(true)

    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })

    expect(
      enforcement.beforeToolCall({
        toolName: 'glob',
        input: { pattern: '**/*.ts' },
        agentId: 'savant',
      }).blocked,
    ).toBe(false)
  })

  it('completion gate blocks an ungrounded turn end with corrective steering', () => {
    const enforcement = new EchoEnforcement('hybrid')
    const result = enforcement.evaluateUngroundedTurnEnd()
    expect(result.blocked).toBe(true)
    expect(result.steering).toContain('Session-init grounding required')
    expect(result.steering).toContain('ECHO.md')
  })

  it('completion gate passes after the protocol is read', () => {
    const enforcement = new EchoEnforcement('hybrid')
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    expect(enforcement.evaluateUngroundedTurnEnd()).toEqual({ blocked: false })
  })

  it('completion gate disarms with a one-time notice after the retry cap', () => {
    const enforcement = new EchoEnforcement('hybrid')
    // The cap is 3; retries 1-3 block, the 4th exceeds the cap and disarms.
    expect(enforcement.evaluateUngroundedTurnEnd().blocked).toBe(true)
    expect(enforcement.evaluateUngroundedTurnEnd().blocked).toBe(true)
    expect(enforcement.evaluateUngroundedTurnEnd().blocked).toBe(true)
    const disarmed = enforcement.evaluateUngroundedTurnEnd()
    expect(disarmed.blocked).toBe(false)
    expect(disarmed.notice).toContain('disarmed')
    // Session-wide disarm: further ungrounded turn ends are no-ops.
    expect(enforcement.evaluateUngroundedTurnEnd()).toEqual({ blocked: false })
  })

  it('completion gate is a no-op when gateArmed is false (legacy)', () => {
    const enforcement = new EchoEnforcement('hybrid', { gateArmed: false })
    expect(enforcement.evaluateUngroundedTurnEnd()).toEqual({ blocked: false })
  })

  it('subagent-seeded instances skip the gate', () => {
    const enforcement = new EchoEnforcement('strict', {
      protocolPreSeeded: true,
    })
    const result = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'forge',
    })
    expect(result.blocked).toBe(false)
  })

  it('injects a protocol refresh after five completed logical turns', () => {
    const enforcement = new EchoEnforcement('strict')
    for (const path of [
      'ECHO.md',
      'ARCHITECTURE.md',
      'protocol.config.yaml',
      'dev/LEARNINGS.md',
    ]) {
      enforcement.beforeToolCall({
        toolName: 'read_files',
        input: { paths: [path] },
        agentId: 'savant',
      })
      enforcement.recordSuccessfulGroundingRead([path])
    }

    let refresh: string | undefined
    for (let i = 1; i <= 5; i++) {
      refresh = enforcement.recordLogicalUserTurn().refreshText
    }
    expect(refresh).toBeDefined()
    expect(refresh).toContain('<!--echo-critical-->')
    expect(refresh).toContain('Read 0-EOF')
    expect(enforcement.recordLogicalUserTurn().refreshText).toBeUndefined()
  })

  it('does not refresh before the protocol is read', () => {
    const enforcement = new EchoEnforcement('strict')
    let refresh: string | undefined
    for (let i = 1; i <= 15; i++) {
      refresh = enforcement.onStepBoundary().refreshText
    }
    expect(refresh).toBeUndefined()
  })

  it('allows the internal backstop during the first long turn after cadence refresh', () => {
    const enforcement = new EchoEnforcement('strict')
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })

    for (let i = 0; i < 5; i++) {
      enforcement.recordLogicalUserTurn()
    }

    let refresh: string | undefined
    for (let i = 0; i < 12; i++) {
      refresh = enforcement.onStepBoundary().refreshText
    }
    expect(refresh).toContain('<!--echo-critical-->')
  })

  it('rejects duplicate paths in a persisted grounding checkpoint', () => {
    const agentState = {
      agentId: 'main',
      protocolVariant: 'harness',
      protocolFile: 'ECHO.md',
      protocolSource: 'local',
      protocolVersion: '0.2.0',
      groundingCheckpoint: {
        schemaVersion: 1,
        gateArmed: true,
        protocolVariant: 'harness',
        protocolFile: 'echo.md',
        protocolSource: 'local',
        protocolVersion: '0.2.0',
        groundingSetFingerprint: 'not-used',
        requiredPaths: ['echo.md', 'echo.md'],
        completedPaths: ['echo.md', 'echo.md'],
        fullGroundingCompleted: true,
        logicalUserTurnCount: 0,
        lastFullGroundingTurn: null,
        lastRefreshTurn: null,
        lastRefreshReason: null,
        lastRefreshEpoch: null,
        completionGateRetries: 0,
        completionGateDisarmed: false,
      },
    } as never
    const enforcement = new EchoEnforcement('hybrid', {
      agentState,
      gateArmed: true,
    })
    expect(enforcement.getState().protocolRead).toBe(false)
  })

  it('delivers a fresh refresh after history replacement even after pre-compaction refresh', () => {
    const enforcement = new EchoEnforcement('strict')
    for (const path of [
      'ECHO.md',
      'ARCHITECTURE.md',
      'protocol.config.yaml',
      'dev/LEARNINGS.md',
    ]) {
      enforcement.beforeToolCall({
        toolName: 'read_files',
        input: { paths: [path] },
        agentId: 'savant',
      })
      enforcement.recordSuccessfulGroundingRead([path])
    }
    expect(enforcement.recordCompaction().refreshText).toBeDefined()
    expect(enforcement.recordHistoryReplacement().refreshText).toContain(
      '<!--echo-critical-->',
    )
  })

  it('requests an idempotent refresh for compaction', () => {
    const enforcement = new EchoEnforcement('strict')
    for (const path of [
      'ECHO.md',
      'ARCHITECTURE.md',
      'protocol.config.yaml',
      'dev/LEARNINGS.md',
    ]) {
      enforcement.beforeToolCall({
        toolName: 'read_files',
        input: { paths: [path] },
        agentId: 'savant',
      })
      enforcement.recordSuccessfulGroundingRead([path])
    }
    const first = enforcement.recordCompaction().refreshText
    const second = enforcement.recordCompaction().refreshText
    expect(first).toContain('<!--echo-critical-->')
    expect(second).toBeUndefined()
  })
})

describe('FID-0811-005 typed contract boundary', () => {
  it('keeps valid modes and defaults an absent mode to hybrid', () => {
    expect(resolveEnforcementMode(undefined)).toBe('hybrid')
    expect(resolveEnforcementMode('hybrid')).toBe('hybrid')
    expect(resolveEnforcementMode('strict')).toBe('strict')
  })

  it('rejects an invalid runtime mode instead of silently downgrading', () => {
    expect(() => resolveEnforcementMode('invalid' as never)).toThrow(
      'Invalid EHEL enforcement mode',
    )
  })

  it('stores one enforcement instance per agent state without serializing it', () => {
    const state = { enforcementMode: 'strict' } as never
    const first = getOrCreateEnforcement(state)
    expect(getOrCreateEnforcement(state)).toBe(first)
    expect(JSON.stringify(state)).toBe('{"enforcementMode":"strict"}')
  })
})
