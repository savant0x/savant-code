/**
 * FID-2026-1001-003 step 4 — N=3 repeat-block escalation ladder.
 *
 * Pins the contract the FID specifies for the restored Law 3 hard block:
 *   - identical blocks keyed (law, tool, canonical targetPath) count strikes;
 *   - at N=3 the block carries the escalation notice (same reason base);
 *   - the NEXT repeat arms the turn termination (the harder response —
 *     "notifies but does not compel" is the pattern this FID ends);
 *   - an intervening compliant READ resets the ladder (any law);
 *   - a verification-shaped command resets law-3 strikes (Law 13: the SAME
 *     detector the credit path uses);
 *   - the verification-escape clause never lets the block fire on its own
 *     cure (no deadlock).
 *
 * The boundary consumption itself is `consumeTurnTermination` (one-shot),
 * called by run-agent-step/loop/boundary-gates.ts →
 * applyLawEscalationTermination (main loop only, like the turn-end gate).
 */
import { describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'
import {
  consumeTurnTermination,
  LAW_BLOCK_ESCALATION_THRESHOLD,
} from '../enforcement/escalation'
import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'

import type { EnforcementState } from '../types'

function stateWithDirtyCode(): EnforcementState {
  const state = createEnforcementState()
  state.dirtyFiles.add('/proj/src/a.ts')
  state.hasVerifiedSinceLastDirty = false
  return state
}

function attemptWrite(state: EnforcementState) {
  return runPreWriteGates({
    toolName: 'write_file',
    input: { path: '/proj/src/b.ts' },
    agentId: 'savant',
    state,
    mode: 'hybrid',
    tier: 'core_4',
  })
}

describe('FID-2026-1001-003 step 4 — escalation ladder', () => {
  it('blocks N times without termination, arms on the next repeat, consumes once', () => {
    const state = stateWithDirtyCode()
    let last = attemptWrite(state)
    for (let i = 1; i < LAW_BLOCK_ESCALATION_THRESHOLD; i++) {
      expect(last.blocked).toBe(true)
      expect(last.terminateTurn).toBe(false)
      expect(state.turnTerminationArmed).toBe(false)
      last = attemptWrite(state)
    }
    // The Nth identical block: escalation notice, still no termination.
    expect(last.blocked).toBe(true)
    expect(last.terminateTurn).toBe(false)
    expect(last.reason).toContain('escalation')
    expect(state.turnTerminationArmed).toBe(false)
    // The next repeat: the harder response.
    const fourth = attemptWrite(state)
    expect(fourth.blocked).toBe(true)
    expect(fourth.terminateTurn).toBe(true)
    expect(state.turnTerminationArmed).toBe(true)
    expect(consumeTurnTermination(state)).toBe(true)
    expect(consumeTurnTermination(state)).toBe(false)
  })

  it('a different target per write never escalates (multi-file batch safety)', () => {
    const state = stateWithDirtyCode()
    for (const target of ['b', 'c', 'd', 'e', 'f']) {
      const result = runPreWriteGates({
        toolName: 'write_file',
        input: { path: `/proj/src/${target}.ts` },
        agentId: 'savant',
        state,
        mode: 'hybrid',
        tier: 'core_4',
      })
      expect(result.blocked).toBe(true)
      expect(result.terminateTurn).toBe(false)
      expect(state.turnTerminationArmed).toBe(false)
    }
  })

  it('an intervening compliant read resets the ladder (full pipeline)', () => {
    const enforcement = new EchoEnforcement('hybrid')
    // Satisfy the session-init gate (this read also resets the empty ladder).
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    enforcement.afterToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/a.ts' },
      result: { text: 'ok' },
      writeSucceeded: true,
    })
    for (let i = 0; i < 2; i++) {
      const blocked = enforcement.beforeToolCall({
        toolName: 'write_file',
        input: { path: '/proj/src/b.ts' },
        agentId: 'savant',
      })
      expect(blocked.blocked).toBe(true)
    }
    // A compliant read intervenes.
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['README.md'] },
      agentId: 'savant',
    })
    const after = enforcement.beforeToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/b.ts' },
      agentId: 'savant',
    })
    expect(after.blocked).toBe(true)
    expect(after.terminateTurn).toBe(false) // ladder restarted at 1
    expect(enforcement.state.turnTerminationArmed).toBe(false)
  })

  it('a verification-shaped command resets law-3 strikes (Law 13 predicate)', () => {
    const enforcement = new EchoEnforcement('hybrid')
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    enforcement.afterToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/a.ts' },
      result: { text: 'ok' },
      writeSucceeded: true,
    })
    for (let i = 0; i < 2; i++) {
      expect(
        enforcement.beforeToolCall({
          toolName: 'write_file',
          input: { path: '/proj/src/b.ts' },
          agentId: 'savant',
        }).blocked,
      ).toBe(true)
    }
    // The verification run itself is not blocked (non-mutating), and it
    // resets the law-3 ladder on the way through.
    enforcement.beforeToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run typecheck' },
      agentId: 'savant',
    })
    const after = enforcement.beforeToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/b.ts' },
      agentId: 'savant',
    })
    expect(after.blocked).toBe(true)
    expect(after.terminateTurn).toBe(false)
  })

  it('the verification-escape clause does not deadlock the gate (block never fires on its own cure)', () => {
    const state = stateWithDirtyCode()
    // Simulate the pipeline stash for a verification-shaped call that the
    // classifier marked mutating (e.g. a redirecting verification run) —
    // the restored other-dirty leg MUST NOT block it.
    state.pendingMutation = { mutates: true, targets: [], scope: 'tree' }
    const result = runPreWriteGates({
      toolName: 'run_terminal_command',
      input: { command: 'bun run typecheck' },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
  })
})
