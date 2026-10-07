/**
 * Law 15 capture-side pins for FID-2026-1006-004 (P1/P2/P6/P9/P10 plus the
 * durability round trip). Deletion-class pins live in
 * `worktree-reconcile-deletion.test.ts`.
 *
 * No assertion here references wall-clock time: where a budget must be forced
 * it is INJECTED (`budgetMs: 0` — `spawnSync` treats a 0 timeout as "no
 * timeout", so enumeration still succeeds and the hash leg cannot run).
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  enforcementForCheckpoint,
  groundedAgentState,
  tempGitRepo,
} from './worktree-reconcile-fixtures'
import {
  captureWorktreeBaseline,
  maybeCaptureWorktreeBaseline,
  shouldRetryCapture,
} from '../enforcement/worktree-capture'
import {
  isSpuriousTimeout,
  runGitFileList,
  type GitSpawnAttemptFn,
} from '../enforcement/worktree-git'
import { reconcileWorktree } from '../enforcement/worktree-reconcile'

const CLEAN_SCALE = Array.from(
  { length: 60 },
  (_, index) => `clean-${String(index).padStart(2, '0')}.ts`,
)
const DIRTY_SCALE = ['dirty-a.ts', 'dirty-b.ts']

describe('P1 — capture cost is a function of the dirty set, not repository size', () => {
  it('hashes only the initially-dirty set and still inventories every path', () => {
    const { root } = tempGitRepo({
      clean: CLEAN_SCALE,
      dirty: DIRTY_SCALE,
    })
    const checkpoint = groundedAgentState().groundingCheckpoint!
    captureWorktreeBaseline({ checkpoint, repoRoot: root })

    expect(checkpoint.worktreeBaselineMethod).toBe('git')
    // The content record is exactly the M dirty paths. The pre-split
    // implementation hashed all N+M and this assertion fails on it.
    expect(Object.keys(checkpoint.worktreeBaseline ?? {}).sort()).toEqual(
      [...DIRTY_SCALE].sort(),
    )
    expect([...(checkpoint.worktreeBaselineDirtyPaths ?? [])].sort()).toEqual(
      [...DIRTY_SCALE].sort(),
    )
    // The inventory covers N+M: the deletions net no longer needs a hash.
    expect(checkpoint.worktreeBaselinePaths?.length).toBe(
      CLEAN_SCALE.length + DIRTY_SCALE.length,
    )
    expect([...(checkpoint.worktreeBaselinePaths ?? [])].sort()).toEqual(
      [...CLEAN_SCALE, ...DIRTY_SCALE].sort(),
    )
  })
})

describe('P2 — a refusal is preserved, and it names the leg', () => {
  it('refuses on a spent hash budget, wipes the map, and the advisory names it', () => {
    const { root } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    captureWorktreeBaseline({ checkpoint, repoRoot: root, budgetMs: 0 })

    expect(checkpoint.worktreeBaselineMethod).toBe('unavailable')
    expect(checkpoint.worktreeBaseline).toEqual({})
    expect(checkpoint.worktreeBaselinePaths).toEqual([])
    expect(checkpoint.worktreeBaselineFailure).toBe('hash-budget')
    expect(checkpoint.worktreeBaselineRetries).toBe(1)

    const enf = enforcementForCheckpoint(checkpoint)
    const outcome = reconcileWorktree({
      checkpoint,
      repoRoot: root,
      dirtyFiles: enf.state.dirtyFiles,
    })
    expect(outcome.unverifiable).toBe(true)
    expect(outcome.method).toBe('unavailable')
    expect(outcome.changed).toEqual([])
    expect(outcome.diagnostic).toContain('cannot verify')
    expect(outcome.diagnostic).toContain('hash-budget')
  })
})

describe('P6 — a failed dirty-set enumeration refuses the capture (fail-closed)', () => {
  it('names the dirty-set leg when the inventory enumerates but the change set does not', () => {
    const { root } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    // Injected seam (no module mocking): ls-files answers, status does not.
    const attempt: GitSpawnAttemptFn = (args) =>
      args[0] === 'ls-files'
        ? { status: 0, stdout: 'tracked.ts\0', elapsedMs: 1 }
        : { status: 128, stdout: '', elapsedMs: 3 }

    captureWorktreeBaseline({ checkpoint, repoRoot: root, attempt })

    // The reduced map makes an undefined dirty set fail OPEN (the candidate
    // seed collapses while `method` still reads 'git'), so this must refuse.
    expect(checkpoint.worktreeBaselineMethod).toBe('unavailable')
    expect(checkpoint.worktreeBaselineFailure).toBe('dirty-set')
    expect(checkpoint.worktreeBaseline).toEqual({})
    expect(checkpoint.worktreeBaselineDirtyPaths).toBeUndefined()
  })
})

describe('P9 — a refused baseline is recoverable (bounded recapture)', () => {
  it('gates on the method, the retry cap and the cooldown — purely', () => {
    const now = 1_000_000
    const gate = (
      method: 'git' | 'walk' | 'unavailable',
      retries: number,
      lastAttemptAtMs: number | null,
    ): boolean => shouldRetryCapture({ method, retries, lastAttemptAtMs, now })

    // A live baseline is never re-captured: capture is one-time IO.
    expect(gate('git', 0, now - 120_000)).toBe(false)
    expect(gate('walk', 0, now - 120_000)).toBe(false)
    // Cooldown not yet elapsed, then elapsed → retry.
    expect(gate('unavailable', 0, now - 1_000)).toBe(false)
    expect(gate('unavailable', 0, now - 60_000)).toBe(true)
    // No prior attempt at all → retry; the cap is spent → no retry.
    expect(gate('unavailable', 0, null)).toBe(true)
    expect(gate('unavailable', 2, null)).toBe(false)
  })

  it('promotes a refused baseline on the next mutating call, then stops', () => {
    const { root } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    captureWorktreeBaseline({ checkpoint, repoRoot: root, budgetMs: 0 })
    expect(checkpoint.worktreeBaselineMethod).toBe('unavailable')

    // Cooldown elapsed (arranged, not asserted on) → the retry runs with the
    // default healthy budget and promotes the baseline to live.
    checkpoint.worktreeBaselineCapturedAt = Date.now() - 61_000
    maybeCaptureWorktreeBaseline(checkpoint, 'write_file', root, {
      path: join(root, 'x.ts'),
    })
    expect(checkpoint.worktreeBaselineMethod).toBe('git')
    expect(checkpoint.worktreeBaselineRetries).toBe(0)
    expect(checkpoint.worktreeBaselinePaths?.length).toBeGreaterThan(0)

    // Third call: a live baseline is not re-captured even with the cooldown
    // defeated — a new file on disk must NOT appear in the inventory.
    checkpoint.worktreeBaselineCapturedAt = Date.now() - 61_000
    writeFileSync(join(root, 'added-after.ts'), 'export const added = 1\n')
    const inventoryBefore = [...(checkpoint.worktreeBaselinePaths ?? [])]
    maybeCaptureWorktreeBaseline(checkpoint, 'write_file', root, {
      path: join(root, 'added-after.ts'),
    })
    expect(checkpoint.worktreeBaselinePaths).toEqual(inventoryBefore)
    expect(checkpoint.worktreeBaselinePaths?.includes('added-after.ts')).toBe(
      false,
    )
  })
})

describe('P10 — the spawn classification is honest', () => {
  it('recognises a provably spurious timeout and nothing else', () => {
    // 13 ms against a 500 ms budget: the process did not exhaust its budget.
    expect(
      isSpuriousTimeout({
        errorCode: 'ETIMEDOUT',
        elapsedMs: 13,
        timeoutMs: 500,
      }),
    ).toBe(true)
    // 500 ms against a 500 ms budget: a real budget exhaustion.
    expect(
      isSpuriousTimeout({
        errorCode: 'ETIMEDOUT',
        elapsedMs: 500,
        timeoutMs: 500,
      }),
    ).toBe(false)
    // A 0 timeout means "no timeout" — it can never be provably spurious.
    expect(
      isSpuriousTimeout({ errorCode: 'ETIMEDOUT', elapsedMs: 0, timeoutMs: 0 }),
    ).toBe(false)
    // A different failure is never reclassified as transient.
    expect(
      isSpuriousTimeout({ errorCode: 'ENOENT', elapsedMs: 1, timeoutMs: 500 }),
    ).toBe(false)
    expect(isSpuriousTimeout({ elapsedMs: 1, timeoutMs: 500 })).toBe(false)
  })

  it('retries a spurious timeout once and succeeds', () => {
    const { root } = tempGitRepo()
    let calls = 0
    const attempt: GitSpawnAttemptFn = () => {
      calls += 1
      return calls === 1
        ? { status: null, stdout: '', errorCode: 'ETIMEDOUT', elapsedMs: 13 }
        : { status: 0, stdout: 'tracked.ts\0', elapsedMs: 104 }
    }
    expect(runGitFileList(root, 500, attempt)).toEqual(['tracked.ts'])
    expect(calls).toBe(2)
  })

  it('a REAL failure still degrades — never a silent pass', () => {
    const { root } = tempGitRepo()
    let calls = 0
    const attempt: GitSpawnAttemptFn = () => {
      calls += 1
      return {
        status: null,
        stdout: '',
        errorCode: 'ETIMEDOUT',
        elapsedMs: 500,
      }
    }
    expect(runGitFileList(root, 500, attempt)).toBeNull()
    expect(calls).toBe(1)

    // And capture refuses rather than stamping a baseline it could not build:
    // enumeration failed and the walk fallback cannot run (missing root).
    const checkpoint = groundedAgentState().groundingCheckpoint!
    captureWorktreeBaseline({
      checkpoint,
      repoRoot: join(root, 'missing-dir'),
      budgetMs: 500,
      attempt,
    })
    expect(calls).toBe(2)
    expect(checkpoint.worktreeBaselineMethod).toBe('unavailable')
    expect(checkpoint.worktreeBaselineFailure).toBe('enumerate')
    expect(checkpoint.worktreeBaseline).toEqual({})
  })
})

describe('step 10 — the new durable fields survive the transport round trip', () => {
  it('keeps the inventory, the leg and the retry count across JSON', () => {
    const { root } = tempGitRepo({ dirty: ['dirty-a.ts'] })
    const checkpoint = groundedAgentState().groundingCheckpoint!
    captureWorktreeBaseline({ checkpoint, repoRoot: root })

    const restored = JSON.parse(JSON.stringify(checkpoint)) as Record<
      string,
      unknown
    >

    expect(restored.worktreeBaselinePaths).toEqual(
      checkpoint.worktreeBaselinePaths,
    )
    expect(restored.worktreeBaselineDirtyPaths).toEqual(
      checkpoint.worktreeBaselineDirtyPaths,
    )
    expect(restored.worktreeBaselineRetries).toBe(0)
    // A successful capture records no leg: the key is absent on the wire.
    expect('worktreeBaselineFailure' in restored).toBe(false)
  })
})
