/**
 * EHEL pre-write gates — Law 3 verification gate (FID-2026-0820-012,
 * blocking scope re-defined by FID-2026-0918-005, other-dirty leg RESTORED
 * by FID-2026-1001-003 step 4 under Ruling 1: Laws 1-4 are not advice).
 *
 * Current contract:
 *   1. Target-dirty hard block — re-editing a file that is itself
 *      dirty-and-unverified blocks ("verify before re-editing").
 *   2. Other-dirty hard block (restored 2026-10-02) — OTHER code files'
 *      pending verification blocks again. The FID-2026-0918-005 advisory
 *      (which fixed two 2026-09-18 deadlocks) was ruled attribution
 *      laundering; the deadlock is now prevented by the verification-escape
 *      clause, the failure-attribution/self_correct exemptions, and the
 *      N=3 escalation ladder (law3-escalation.test.ts) instead of by the
 *      demotion. Turn-end Law 15 preserves the no-unverified-exit invariant.
 *
 * Sibling of the Loop-335 decomposition (parent: pre-write-gates.test.ts).
 */
import { describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'

// The credit-mechanism pins (FID-2026-0918-005 repro) live in
// ./law3-credit-mechanism.test.ts — moved verbatim when this file crossed
// the 300-line ceiling during FID-2026-1007-015 P1.

describe('runPreWriteGates — Law 3 gate (other-dirty leg restored, FID-2026-1001-003 step 4)', () => {
  function runLaw3Gate(params: {
    targetPath: string
    dirtyFiles: string[]
    verifiedFiles?: string[]
  }) {
    const state = createEnforcementState()
    for (const d of params.dirtyFiles) state.dirtyFiles.add(d)
    for (const v of params.verifiedFiles ?? []) state.verifiedFiles.add(v)
    // Simulate the post-write flag: set false by every write, cleared only
    // by resetForNewTurn (the FID-2026-0820-012 deadlock precondition).
    state.hasVerifiedSinceLastDirty = false
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: params.targetPath },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
  }

  // ── Part 1: the other-dirty leg (restored to a hard block) ─────────

  it('does NOT block a follow-up write when every dirty file has since passed verification', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/src/a.ts'],
      verifiedFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(false)
    expect(result.warnings.length).toBe(0)
  })

  it('BLOCKS a write to a CLEAN target while OTHER code files are dirty-unverified (restored leg)', () => {
    // Deliberate flip (FID-2026-1001-003 step 4): the FID-2026-0918-005
    // advisory allowed this write; Ruling 1 reinstates the block. The
    // deadlock this could cause is prevented by the verification-escape
    // clause and the N=3 escalation ladder, not by the demotion.
    const result = runLaw3Gate({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 3')
    expect(result.reason).toContain('/proj/src/a.ts')
    expect(result.terminateTurn).toBe(false) // first block: block, not termination
  })

  it('block reason lists only the unverified set under partial credit', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/c.ts',
      dirtyFiles: ['/proj/src/a.ts', '/proj/src/b.ts'],
      verifiedFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('/proj/src/b.ts')
    expect(result.reason).not.toContain('/proj/src/a.ts')
  })

  // ── Part 2: the target-dirty hard block (kept, narrowed) ────────────

  it('STILL BLOCKS re-editing a dirty-unverified code target (target-dirty leg)', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/a.ts',
      dirtyFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 3')
    expect(result.reason).toContain('/proj/src/a.ts')
    expect(result.reason).toContain('re-editing')
  })

  it('target-dirty comparison matches across path spellings (canonical form)', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/./a.ts',
      dirtyFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(true)
  })

  it('re-editing a VERIFIED dirty file does not block (cumulative credit preserved)', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/a.ts',
      dirtyFiles: ['/proj/src/a.ts'],
      verifiedFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(false)
  })

  // ── Exempt paths (FID-2026-0820-012, unchanged) ─────────────────────

  it('does NOT block an exempt-path write (dev/fids/) while code verification is pending', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/dev/fids/FID-2026-0820-012-x.md',
      dirtyFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(false)
  })

  it('does NOT block exempt-path writes under dev/scratchpad/ and dev/nova/', () => {
    for (const target of [
      '/proj/dev/scratchpad/notes.md',
      '/proj/dev/nova/outbox.md',
    ]) {
      const result = runLaw3Gate({
        targetPath: target,
        dirtyFiles: ['/proj/src/a.ts'],
      })
      expect(result.blocked).toBe(false)
    }
  })

  // ── Docs split (FID-2026-0917-002, unchanged) ───────────────────────

  it('does NOT block any write when the only unverified dirty files are DOCS (FID-2026-0917-002)', () => {
    for (const target of [
      '/proj/src/b.ts',
      '/proj/docs/report.md',
      '/proj/dev/handoff.md',
    ]) {
      const result = runLaw3Gate({
        targetPath: target,
        dirtyFiles: ['/proj/dev/handoff.md', '/proj/README.md'],
      })
      expect(result.blocked).toBe(false)
    }
  })

  it('does NOT block the self-fix write to an unverified dirty doc (deadlock regression)', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/dev/handoff.md',
      dirtyFiles: ['/proj/dev/handoff.md'],
    })
    expect(result.blocked).toBe(false)
  })

  it('docs mixed with code never appear in the pending set', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/dev/handoff.md', '/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('/proj/src/a.ts')
    expect(result.reason).not.toContain('/proj/dev/handoff.md')
  })
})

describe('Law 3 batch-verify-once lane (FID-2026-1007-015 P1, operator ruling 2026-10-08 "verify once seems optimal")', () => {
  function runInPhase(params: {
    targetPath: string
    dirtyFiles: string[]
    fsmPhase: string
  }) {
    const state = createEnforcementState()
    for (const d of params.dirtyFiles) state.dirtyFiles.add(d)
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: params.targetPath },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
      fsmPhase: params.fsmPhase,
    })
  }

  it('green phase: other-dirty is an ADVISORY (batch the writes, verify once)', () => {
    const result = runInPhase({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/src/a.ts'],
      fsmPhase: 'green',
    })
    expect(result.blocked).toBe(false)
    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]?.law).toBe(3)
    expect(result.warnings[0]?.message).toContain('Batch-verify-once')
    expect(result.warnings[0]?.message).toContain('2026-10-08')
  })

  it('green phase: the TARGET-DIRTY leg still hard-blocks (verify before re-editing)', () => {
    const result = runInPhase({
      targetPath: '/proj/src/a.ts',
      dirtyFiles: ['/proj/src/a.ts'],
      fsmPhase: 'green',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('re-editing')
  })

  it('non-green phases keep the hard block (audit)', () => {
    const result = runInPhase({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/src/a.ts'],
      fsmPhase: 'audit',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 3')
  })

  it('non-green phases keep the hard block (adversarial)', () => {
    const result = runInPhase({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/src/a.ts'],
      fsmPhase: 'adversarial',
    })
    expect(result.blocked).toBe(true)
  })

  it('an undefined phase fails CLOSED to the hard block (typo-proof)', () => {
    const result = runInPhase({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/src/a.ts'],
      fsmPhase: 'gren' as string,
    })
    expect(result.blocked).toBe(true)
  })
})
