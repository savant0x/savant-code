/**
 * FID-2026-1001-003 step 1: the terminal mutation bypass through the LIVE
 * pipeline. A mutating terminal call passes the SAME pre-write gate chain
 * as a write tool; on pass its targets join filesWritten/dirtyFiles and
 * revoke verification credit (Law 15 then blocks the turn until verified);
 * a FAILED command records nothing; a blocked call consumes the stash. A
 * session whose FIRST call is a mutating terminal command still captures a
 * worktree baseline (step 2's backstop needs it).
 *
 * Pure classifier pins live in `terminal-mutation-classifier.test.ts`.
 */
import { afterEach, describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'
import {
  cleanupTempDirs,
  existingTempFile,
  groundedCheckpoint,
  satisfyGate,
} from './terminal-bypass-fixtures'
import { maybeCaptureWorktreeBaseline } from '../enforcement/worktree-capture'

afterEach(cleanupTempDirs)

describe('terminal bypass through the live pipeline (FID-2026-1001-003 step 1)', () => {
  it('Law 1 blocks an un-read in-place edit of an existing file', () => {
    const target = existingTempFile()
    const enf = new EchoEnforcement('hybrid')
    satisfyGate(enf)
    const result = enf.beforeToolCall({
      toolName: 'run_terminal_command',
      input: { command: `sed -i 's/a/b/' "${target}"` },
      agentId: 'main',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 1')
    expect(result.reason).toContain('terminal mutation target')
  })

  it('a prior read satisfies Law 1 for the classified target', () => {
    const target = existingTempFile()
    const enf = new EchoEnforcement('hybrid')
    satisfyGate(enf)
    enf.beforeToolCall({
      toolName: 'read_files',
      input: { paths: [target] },
      agentId: 'main',
    })
    const result = enf.beforeToolCall({
      toolName: 'run_terminal_command',
      input: { command: `sed -i 's/a/b/' "${target}"` },
      agentId: 'main',
    })
    expect(result.blocked).toBe(false)
  })

  it('on pass, targets join the tracking sets and revoke verification credit', () => {
    const target = existingTempFile()
    const enf = new EchoEnforcement('hybrid')
    satisfyGate(enf)
    enf.beforeToolCall({
      toolName: 'read_files',
      input: { paths: [target] },
      agentId: 'main',
    })
    const before = enf.beforeToolCall({
      toolName: 'run_terminal_command',
      input: { command: `sed -i 's/a/d/' "${target}"` },
      agentId: 'main',
    })
    expect(before.blocked).toBe(false)
    enf.afterToolCall({
      toolName: 'run_terminal_command',
      input: { command: `sed -i 's/a/d/' "${target}"` },
      result: { text: 'ok' },
      commandSucceeded: true,
    })
    const state = enf.getState()
    expect(state.filesWritten.has(target)).toBe(true)
    expect(state.dirtyFiles.has(target)).toBe(true)
    expect(state.writeCount).toBe(1)
  })

  it('a FAILED command records nothing (mutated nothing)', () => {
    const target = existingTempFile()
    const enf = new EchoEnforcement('hybrid')
    satisfyGate(enf)
    enf.beforeToolCall({
      toolName: 'read_files',
      input: { paths: [target] },
      agentId: 'main',
    })
    enf.beforeToolCall({
      toolName: 'run_terminal_command',
      input: { command: `sed -i 's/a/b/' "${target}"` },
      agentId: 'main',
    })
    enf.afterToolCall({
      toolName: 'run_terminal_command',
      input: { command: `sed -i 's/a/b/' "${target}"` },
      result: { error: 'sed: cannot read file: No such file' },
      commandSucceeded: false,
    })
    const state = enf.getState()
    expect(state.filesWritten.size).toBe(0)
    expect(state.dirtyFiles.size).toBe(0)
    expect(state.writeCount).toBe(0)
  })

  it('a blocked call consumes the stash — later calls inherit nothing', () => {
    const enf = new EchoEnforcement('hybrid')
    satisfyGate(enf)
    const blocked = enf.beforeToolCall({
      toolName: 'run_terminal_command',
      input: { command: `sed -i 's/a/b/' "${existingTempFile()}"` },
      agentId: 'main',
    })
    expect(blocked.blocked).toBe(true)
    const later = enf.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['other.ts'] },
      agentId: 'main',
    })
    expect(later.blocked).toBe(false)
    enf.afterToolCall({
      toolName: 'read_files',
      input: { paths: ['other.ts'] },
      result: {},
    })
    expect(enf.getState().filesWritten.size).toBe(0)
  })

  it('read-only shell commands leave the tracking sets untouched', () => {
    const enf = new EchoEnforcement('hybrid')
    satisfyGate(enf)
    enf.beforeToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'ls -la' },
      agentId: 'main',
    })
    enf.afterToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'ls -la' },
      result: { text: 'x' },
      commandSucceeded: true,
    })
    const state = enf.getState()
    expect(state.filesWritten.size).toBe(0)
    expect(state.dirtyFiles.size).toBe(0)
    expect(state.writeCount).toBe(0)
  })

  it('end-to-end: bypassed mutation makes Law 15 block the turn until verified', () => {
    // Law 15's hard turn-end block is strict-tier (hybrid defers to an
    // advisory) — the FID's central wedge scenario is a strict session.
    const target = existingTempFile()
    const enf = new EchoEnforcement('strict')
    satisfyGate(enf)
    // Strict sessions log intent before the first mutation (Law 8 gates
    // the terminal bypass exactly as it gates a write tool).
    enf.beforeToolCall({
      toolName: 'write_todos',
      input: { todos: [{ task: 'mutate via sed', completed: false }] },
      agentId: 'main',
    })
    enf.beforeToolCall({
      toolName: 'read_files',
      input: { paths: [target] },
      agentId: 'main',
    })
    enf.beforeToolCall({
      toolName: 'run_terminal_command',
      input: { command: `sed -i 's/a/b/' "${target}"` },
      agentId: 'main',
    })
    enf.afterToolCall({
      toolName: 'run_terminal_command',
      input: { command: `sed -i 's/a/b/' "${target}"` },
      result: { text: 'ok' },
      commandSucceeded: true,
    })
    expect(enf.evaluateTurnEnd().blocked).toBe(true)
    // A green verification run re-arms the turn end.
    enf.afterToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'bun run typecheck' },
      result: { text: 'ok' },
      commandSucceeded: true,
    })
    expect(enf.evaluateTurnEnd().blocked).toBe(false)
  })
})

describe('step 2 capture gap: first-call-is-terminal (FID-2026-1001-003)', () => {
  it('a first call that is a mutating terminal command captures the baseline', () => {
    const checkpoint = groundedCheckpoint()
    maybeCaptureWorktreeBaseline(
      checkpoint,
      'run_terminal_command',
      process.cwd(),
      { command: 'rm some-file.txt' },
    )
    expect(typeof checkpoint.worktreeBaselineCapturedAt).toBe('number')
  })

  it('a first read-only terminal call still does not capture (pure-read sessions stay free)', () => {
    const checkpoint = groundedCheckpoint()
    maybeCaptureWorktreeBaseline(
      checkpoint,
      'run_terminal_command',
      process.cwd(),
      { command: 'ls -la' },
    )
    expect(checkpoint.worktreeBaselineCapturedAt).toBeUndefined()
  })
})
