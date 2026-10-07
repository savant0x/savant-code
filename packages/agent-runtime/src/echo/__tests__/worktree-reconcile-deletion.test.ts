/**
 * Law 15 reconcile-side pins for FID-2026-1006-004 — the change-bounded
 * deletion source (one class per term, so each is pinned by the fixture that
 * only that term can see) and the candidate-scoping rule that keeps a failed
 * status leg from reporting the whole clean tree.
 *
 * Capture-side pins live in `worktree-capture-scale.test.ts`; the pre-existing
 * reconcile contracts live in `worktree-reconcile.test.ts`.
 */
import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  enforcementForCheckpoint,
  groundedAgentState,
  tempGitRepo,
} from './worktree-reconcile-fixtures'
import {
  advanceWorktreeBaseline,
  captureWorktreeBaseline,
  hashFile,
} from '../enforcement/worktree-capture'
import {
  reconcileWorktree,
  type ReconcileOutcome,
} from '../enforcement/worktree-reconcile'
import { canonicalizePath } from '../path-canonicalization'

/**
 * These pins assert WHICH paths a deletion class can see — never how fast the
 * scan ran — but every test here builds a real temp git repo and spawns git
 * several times, so the production `RECONCILE_BUDGET_MS = 500` default makes
 * the outcome a function of machine load rather than of behaviour. That was
 * not hypothetical: a loaded `validate:repository` run (which live re-runs this
 * record's declared gates) failed this suite while four consecutive unloaded
 * runs and an unloaded `fid:verify --check` all passed. The budget is
 * injectable for exactly this reason, so the pins pin behaviour and let a
 * loaded machine take as long as it needs. Budget-degradation behaviour is
 * pinned deliberately elsewhere (the scale suite's explicit small budgets).
 */
const PIN_BUDGET_MS = 30_000

function reconcile(
  enf: ReturnType<typeof enforcementForCheckpoint>,
  repoRoot: string,
): ReconcileOutcome {
  return reconcileWorktree({
    checkpoint: enf.agentState?.groundingCheckpoint,
    repoRoot,
    dirtyFiles: enf.state.dirtyFiles,
    budgetMs: PIN_BUDGET_MS,
  })
}

const FORTY = Array.from(
  { length: 40 },
  (_, index) => `file-${String(index).padStart(2, '0')}.ts`,
)

describe('P3 — deletion fidelity on a multi-file tree (no status-code parsing)', () => {
  it('detects an UNSTAGED removal of one tracked file among forty', () => {
    const { root } = tempGitRepo({ clean: FORTY })
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })

    rmSync(join(root, 'file-05.ts'))

    const outcome = reconcile(enf, root)
    expect(outcome.deleted).toEqual(['file-05.ts'])
    expect(outcome.changed).toEqual([])
    // A deletion is a distinct outcome: reported, never merged into dirtyFiles.
    expect(enf.state.dirtyFiles.size).toBe(0)
    // No livelock: the path left the durable baseline, so it is not re-reported.
    expect(reconcile(enf, root).deleted).toEqual([])
  })

  it('a rename source is emitted and gone — reported as a deletion', () => {
    const { root } = tempGitRepo({ clean: ['alpha.ts'] })
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })

    renameSync(join(root, 'alpha.ts'), join(root, 'omega.ts'))

    const outcome = reconcile(enf, root)
    expect(outcome.deleted).toEqual(['alpha.ts'])
    // The destination arrives as an unaccounted change (status source), so the
    // rename is visible on both ends.
    expect(outcome.changed).toContain(canonicalizePath(join(root, 'omega.ts')))
  })
})

describe('P4 — a legacy checkpoint keeps working (no back-fill migration)', () => {
  it('detects a removal against a pre-split full-inventory map', () => {
    const { root, cleanPaths } = tempGitRepo({ clean: ['a.ts', 'b.ts'] })
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)

    // Hand-built pre-split shape: the map IS the inventory, and the new field
    // does not exist. Fabricating an inventory from the map would exclude every
    // file that was clean at the legacy capture, so nothing is back-filled.
    const legacy: Record<string, string> = {}
    for (const relPath of cleanPaths) {
      const digest = hashFile(join(root, relPath))
      if (digest !== null) legacy[relPath] = digest
    }
    checkpoint.worktreeBaseline = legacy
    checkpoint.worktreeBaselinePaths = undefined
    checkpoint.worktreeBaselineRoot = root
    checkpoint.worktreeBaselineMethod = 'git'
    checkpoint.worktreeBaselineCapturedAt = Date.now()
    checkpoint.worktreeBaselineDirtyPaths = undefined

    rmSync(join(root, 'a.ts'))

    const outcome = reconcile(enf, root)
    expect(outcome.deleted).toEqual(['a.ts'])
    expect(outcome.changed).toEqual([])
    expect(checkpoint.worktreeBaselinePaths).toBeUndefined()
  })
})

describe('P5 — walk-sourced absence is unknown, not evidence of change', () => {
  it('reports N unexamined rather than N unaccounted findings', () => {
    const { root } = tempGitRepo({
      clean: ['clean-a.ts', 'clean-b.ts', 'resources/vendored.ts'],
    })
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })
    expect(checkpoint.worktreeBaselinePaths?.length).toBe(3)

    // Kill the status leg for real: git cannot answer at all, and the walk
    // still enumerates the tree.
    rmSync(join(root, '.git'), { recursive: true, force: true })

    const outcome = reconcile(enf, root)
    expect(outcome.method).toBe('git')
    expect(outcome.degraded).toBe(true)
    expect(outcome.unverifiable).toBe(false)
    // Two walk-visible clean files with no stored hash — unknown, not changed.
    expect(outcome.unexamined).toBe(2)
    expect(outcome.changed).toEqual([])
    // A tracked path under a walk-excluded directory is never walked, so its
    // absence proves nothing.
    expect(outcome.deleted).toEqual([])
    expect(outcome.diagnostic).toContain('unexamined')
    expect(enf.state.dirtyFiles.size).toBe(0)
  })
})

describe('P7 — a vanished untracked-at-capture file', () => {
  it('is detected even though git emits no status entry for it', () => {
    const { root } = tempGitRepo()
    writeFileSync(join(root, 'scratch-untracked.ts'), 'export const s = 1\n')
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })
    // The dirty-at-capture seed is what makes the class visible at all.
    expect(checkpoint.worktreeBaseline?.['scratch-untracked.ts']).toBeDefined()

    rmSync(join(root, 'scratch-untracked.ts'))

    const outcome = reconcile(enf, root)
    expect(outcome.deleted).toEqual(['scratch-untracked.ts'])
    expect(outcome.changed).toEqual([])
    expect(enf.state.dirtyFiles.size).toBe(0)
    expect(reconcile(enf, root).deleted).toEqual([])
  })
})

describe('P8 — a vanished session-created path', () => {
  it('is detected after advanceWorktreeBaseline recorded it', () => {
    const { root } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })

    const created = join(root, 'session-made.ts')
    writeFileSync(created, 'export const made = 1\n')
    advanceWorktreeBaseline({ checkpoint, repoRoot: root, paths: [created] })
    expect(checkpoint.worktreeBaseline?.['session-made.ts']).toBeDefined()

    rmSync(created)

    // Neither status (untracked then gone) nor the frozen inventory can see it:
    // the map keys outside the inventory are the only net.
    const outcome = reconcile(enf, root)
    expect(outcome.deleted).toEqual(['session-made.ts'])
    expect(outcome.changed).toEqual([])
    expect(reconcile(enf, root).deleted).toEqual([])
  })
})
