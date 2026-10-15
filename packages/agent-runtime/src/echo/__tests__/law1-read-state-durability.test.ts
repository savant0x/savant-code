/**
 * Law 1 read-state durability — FID-2026-1001-003 step 3 (Branch A defect).
 *
 * `filesRead` lived ONLY on the in-memory `EchoEnforcement` instance, which
 * is WeakMap-keyed by `agentState` object identity
 * (`enforcement/factory.ts → getOrCreateEnforcement`). A session restore /
 * state replacement installs a NEW agentState object → the factory builds a
 * NEW instance with an EMPTY `filesRead` → Law 1 re-blocks every write to a
 * file the agent demonstrably read and already wrote this session.
 *
 * Contract pinned here: the read ledger must survive instance replacement by
 * mirroring into the durable `GroundingCheckpoint` on `agentState` (the
 * precedent: `completionGateRetries`), and a fresh instance must hydrate
 * from it. Reproduction test first (FID discipline): the first two tests
 * failed against the pre-fix tree.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'
import { createEnforcementState } from '../enforcement-state'
import { createGroundingCheckpoint, isAgentGrounded } from '../grounding'

import type { AgentState } from '@savant-code/common/types/session-state'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * A minimal AgentState-shaped stub carrying a REAL grounding checkpoint (the
 * constructor hydrates only when `isAgentGrounded` passes, which requires a
 * fully-completed real checkpoint — no type-cast lies on the grounding
 * fields).
 */
function groundedAgentState(): AgentState {
  const agentState = {
    protocolFile: 'ECHO.md',
    parentId: undefined,
    messageHistory: [],
  } as unknown as AgentState
  const checkpoint = createGroundingCheckpoint(agentState)
  if (!checkpoint) throw new Error('checkpoint creation failed')
  checkpoint.requiredPaths = ['echo.md']
  checkpoint.completedPaths = ['echo.md']
  checkpoint.fullGroundingCompleted = true
  agentState.groundingCheckpoint = checkpoint
  expect(isAgentGrounded(agentState)).toBe(true)
  return agentState
}

/**
 * The exact factory scenario from the defect report: the state OBJECT is
 * replaced (session restore), so the WeakMap key changes and the factory
 * constructs a FRESH instance. In-memory tracking sets are gone — the only
 * durable surface is the grounding checkpoint the replacement object
 * carries (serialized with the session).
 */
function restoredInstance(agentState: AgentState): EchoEnforcement {
  const replacement = {
    protocolFile: agentState.protocolFile,
    parentId: agentState.parentId,
    messageHistory: [],
  } as unknown as AgentState
  replacement.groundingCheckpoint = agentState.groundingCheckpoint
  return new EchoEnforcement('hybrid', { agentState: replacement })
}

describe('Law 1 read-state durability across instance replacement (FID-2026-1001-003 step 3)', () => {
  it('REPRODUCES: Law 1 blocks a re-write after the state object is replaced', () => {
    const dir = mkdtempSync(join(tmpdir(), 'law1-durability-'))
    tempDirs.push(dir)
    const target = join(dir, 'mod.ts')
    writeFileSync(target, 'export const value = 1\n')

    const agentState = groundedAgentState()
    const original = new EchoEnforcement('hybrid', { agentState })

    // Register the read + perform the write on the ORIGINAL instance.
    const read = original.beforeToolCall({
      toolName: 'read_files',
      input: { paths: [target] },
      agentId: 'main',
    })
    expect(read.blocked).toBe(false)
    const write = original.afterToolCall({
      toolName: 'write_file',
      input: { path: target },
      result: {},
      writtenContent: 'export const value = 2\n',
      writeSucceeded: true,
    })
    expect(write.blocked).toBe(false)

    // Instance replacement (session restore) — same logical session.
    const restored = restoredInstance(agentState)

    const rewrite = restored.beforeToolCall({
      toolName: 'write_file',
      input: { path: target },
      agentId: 'main',
    })
    // Pre-fix this failed with `Law 1: Read 0-EOF before touch`.
    expect(rewrite.blocked).toBe(false)
  })

  it('REPRODUCES: dirty-unverified Law 15 re-arms only for a NEW modification, not for restored state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'law1-durability-'))
    tempDirs.push(dir)
    const target = join(dir, 'mod.ts')
    writeFileSync(target, 'export const value = 1\n')

    const agentState = groundedAgentState()
    const original = new EchoEnforcement('hybrid', { agentState })
    original.beforeToolCall({
      toolName: 'read_files',
      input: { paths: [target] },
      agentId: 'main',
    })
    original.afterToolCall({
      toolName: 'write_file',
      input: { path: target },
      result: {},
      writtenContent: 'export const value = 2\n',
      writeSucceeded: true,
    })
    // Credit the write with a successful verification run (Law 3 channel).
    original.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run typecheck' },
      result: {},
      commandSucceeded: true,
    })
    // The written content carries an export declaration, so Law 4 wired the
    // file — credit it the same way (grep channel) or the ORIGINAL turn end
    // blocks on Law 4, orthogonal to this suite's subject.
    original.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'grep -rn "value" src' },
      result: {},
      commandSucceeded: true,
    })
    expect(original.evaluateTurnEnd().blocked).toBe(false)

    const restored = restoredInstance(agentState)
    // No NEW writes happened: the restored turn must NOT be blocked.
    expect(restored.evaluateTurnEnd().blocked).toBe(false)
    // And the already-read file stays writable without a re-read.
    const rewrite = restored.beforeToolCall({
      toolName: 'write_file',
      input: { path: target },
      agentId: 'main',
    })
    expect(rewrite.blocked).toBe(false)
  })

  it('hydrated read-ledger does not survive into a fresh logical session (new state object, empty checkpoint ledger)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'law1-durability-'))
    tempDirs.push(dir)
    const target = join(dir, 'mod.ts')
    writeFileSync(target, 'export const value = 1\n')

    const agentStateA = groundedAgentState()
    const sessionA = new EchoEnforcement('hybrid', { agentState: agentStateA })
    sessionA.beforeToolCall({
      toolName: 'read_files',
      input: { paths: [target] },
      agentId: 'main',
    })

    // A genuinely NEW session: different agentState, no durable ledger yet.
    const agentStateB = groundedAgentState()
    const sessionB = new EchoEnforcement('hybrid', { agentState: agentStateB })
    const write = sessionB.beforeToolCall({
      toolName: 'write_file',
      input: { path: target },
      agentId: 'main',
    })
    // Law 1 still guards a session that never read the file.
    expect(write.blocked).toBe(true)
    expect(write.reason).toContain('Law 1')
  })

  it('mirrors reads into the checkpoint and dedupes them', () => {
    const agentState = groundedAgentState()
    const enf = new EchoEnforcement('hybrid', { agentState })
    enf.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['/proj/src/a.ts', '/proj/src/a.ts', '/proj/src/b.ts'] },
      agentId: 'main',
    })
    const ledger = agentState.groundingCheckpoint?.readLedger ?? {}
    // Deduped to 2 canonical entries; key spelling is platform-dependent
    // (canonicalizePath resolves against cwd), so assert count + presence of
    // both distinct files by suffix.
    expect(Object.keys(ledger).length).toBe(2)
    const keys = Object.keys(ledger)
    expect(keys.some((k) => k.endsWith('a.ts'))).toBe(true)
    expect(keys.some((k) => k.endsWith('b.ts'))).toBe(true)
  })
})

describe('createEnforcementState — step 3 support', () => {
  it('exposes a canonical-path read ledger for hydration bookkeeping', () => {
    const state = createEnforcementState()
    expect(state.filesReadCanonical.size).toBe(0)
  })
})
