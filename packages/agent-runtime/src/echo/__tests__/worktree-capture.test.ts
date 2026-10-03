/**
 * Law 15 worktree-baseline capture — FID-2026-1001-003 step 2 (capture-side
 * contract; reconciliation-side pins live in `worktree-reconcile.test.ts`).
 *
 * Pinned here: the ls-files enumeration basis (a CLEAN repo yields a
 * non-empty baseline — porcelain would yield none; untracked-not-ignored
 * files enumerate; gitignored files do not), the verified-batch advance
 * semantics (accounted content never re-flags; unverified mutations are
 * never absorbed), and the Adversary placement mandate (no `worktree*`
 * fields on `EnforcementState`).
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'
import {
  enforcementForCheckpoint,
  groundedAgentState,
  outOfBandEdit,
  tempGitRepo,
} from './worktree-reconcile-fixtures'
import {
  advanceWorktreeBaseline,
  captureWorktreeBaseline,
} from '../enforcement/worktree-capture'
import { reconcileWorktree } from '../enforcement/worktree-reconcile'

describe('git enumeration contract (ls-files basis)', () => {
  it('a CLEAN repo yields a NON-empty baseline (status-porcelain would yield none)', () => {
    const { root } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    captureWorktreeBaseline({ checkpoint, repoRoot: root })
    expect(checkpoint.worktreeBaselineMethod).toBe('git')
    expect(Object.keys(checkpoint.worktreeBaseline ?? {})).toEqual([
      'tracked.ts',
    ])
  })

  it('untracked non-ignored files are enumerated; gitignored files are not', () => {
    const { root } = tempGitRepo()
    writeFileSync(join(root, 'untracked.ts'), 'export const u = 1\n')
    writeFileSync(join(root, '.gitignore'), 'ignored.ts\n')
    writeFileSync(join(root, 'ignored.ts'), 'export const i = 1\n')
    const checkpoint = groundedAgentState().groundingCheckpoint!
    captureWorktreeBaseline({ checkpoint, repoRoot: root })
    const baseline = checkpoint.worktreeBaseline ?? {}
    expect(baseline['untracked.ts']).toBeDefined()
    expect(baseline['ignored.ts']).toBeUndefined()
  })
})

describe('baseline advance (verified-batch semantics)', () => {
  it('advances the baseline over verified paths so later turns stay clean', () => {
    const { root, file } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    captureWorktreeBaseline({ checkpoint, repoRoot: root })
    const enf = enforcementForCheckpoint(checkpoint)

    // Turn 1: sanctioned write (dirty at reconcile)...
    outOfBandEdit(file, 'export const turn1 = 2\n')
    const outcome1 = reconcileWorktree({
      checkpoint,
      repoRoot: root,
      dirtyFiles: enf.state.dirtyFiles,
    })
    expect(outcome1.changed.length).toBe(1)

    // ...then verified and advanced at the clean turn end.
    enf.state.verifiedFiles.add(file)
    advanceWorktreeBaseline({
      checkpoint,
      repoRoot: root,
      paths: [...enf.state.verifiedFiles],
    })

    // Turn 2, fresh batch: the SAME content must not re-flag.
    enf.state.dirtyFiles.clear()
    enf.state.verifiedFiles.clear()
    const outcome2 = reconcileWorktree({
      checkpoint,
      repoRoot: root,
      dirtyFiles: enf.state.dirtyFiles,
    })
    expect(outcome2.changed).toEqual([])
  })

  it('an UNVERIFIED mutation is never absorbed into the baseline (hybrid safety)', () => {
    const { root, file } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    captureWorktreeBaseline({ checkpoint, repoRoot: root })
    const enf = enforcementForCheckpoint(checkpoint)

    // Out-of-band mutation, no verification credit, turn ends clean in
    // hybrid (Law 15 advisory). Advancing over the whole batch would absorb
    // this mutation; advancing over verifiedFiles only must not.
    outOfBandEdit(file, 'export const unverified = 3\n')
    advanceWorktreeBaseline({
      checkpoint,
      repoRoot: root,
      paths: [...enf.state.dirtyFiles], // empty — no credit was granted
    })

    const outcome = reconcileWorktree({
      checkpoint,
      repoRoot: root,
      dirtyFiles: enf.state.dirtyFiles,
    })
    expect(outcome.changed.length).toBe(1)
  })
})

describe('EnforcementState type surface (step 2 support)', () => {
  it('createEnforcementState carries no worktree-baseline fields (Adversary mandate)', () => {
    const { root } = tempGitRepo()
    const agentState = groundedAgentState()
    const enf = new EchoEnforcement('hybrid', { agentState })
    captureWorktreeBaseline({
      checkpoint: agentState.groundingCheckpoint!,
      repoRoot: root,
    })
    const state = enf.getState()
    expect('worktreeBaseline' in state).toBe(false)
  })
})
