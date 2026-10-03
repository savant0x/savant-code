/**
 * Law 15 worktree reconciliation — FID-2026-1001-003 step 2
 * (reconciliation-side contract; capture-side pins live in
 * `worktree-capture.test.ts`).
 *
 * The terminal bypass: one `run_terminal_command` (`sed -i`, `>`,
 * `git checkout`) mutates the tree with no record in `EnforcementState`, so
 * the Law 15 backstop saw nothing. Pinned here:
 *   - git enumerates, sha256 hashing decides — a file dirty at capture AND
 *     modified again is still caught (the porcelain-diff failure mode);
 *   - unaccounted changes MERGE into dirtyFiles and block ("merge and
 *     block", not notify-only);
 *   - deletion is a distinct outcome — dropped from the baseline, never a
 *     livelock on a nonexistent file;
 *   - degraded / unverifiable scans surface a diagnostic, never a silent
 *     pass (capture unavailable → every subsequent turn states it);
 *   - a sanctioned write through the gate is never flagged.
 */
import { rmSync } from 'node:fs'

import { describe, expect, it } from 'bun:test'

import {
  enforcementForCheckpoint,
  groundedAgentState,
  outOfBandEdit,
  tempGitRepo,
} from './worktree-reconcile-fixtures'
import {
  captureWorktreeBaseline,
  hashFile,
} from '../enforcement/worktree-capture'
import {
  reconcileWorktree,
  type ReconcileOutcome,
} from '../enforcement/worktree-reconcile'

function reconcile(
  enf: ReturnType<typeof enforcementForCheckpoint>,
  repoRoot: string,
): ReconcileOutcome {
  return reconcileWorktree({
    checkpoint: enf.agentState?.groundingCheckpoint,
    repoRoot,
    dirtyFiles: enf.state.dirtyFiles,
  })
}

describe('Law 15 worktree reconciliation — merge and block (FID-2026-1001-003 step 2)', () => {
  it('merges an out-of-band mutation into dirtyFiles and reports it changed', () => {
    const { root, file } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })

    outOfBandEdit(file, 'export const mutated = 2\n')

    const outcome = reconcile(enf, root)
    expect(outcome.unverifiable).toBe(false)
    expect(outcome.degraded).toBe(false)
    expect(outcome.method).toBe('git')
    expect(outcome.changed.length).toBe(1)
    expect(outcome.diagnostic).toContain('1 unaccounted changed file(s)')
    // The merge contract: dirtyFiles now carries the bypassed file.
    expect(enf.state.dirtyFiles.size).toBeGreaterThan(0)
  })

  it('catches a file dirty at capture AND modified again (porcelain-diff would miss it)', () => {
    const { root, file } = tempGitRepo()
    // Dirty BEFORE capture, then mutated again after: set-difference of two
    // status snapshots sees the same path twice and reports nothing.
    outOfBandEdit(file, 'export const dirtyAtCapture = 0\n')
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })
    outOfBandEdit(file, 'export const dirtyAtCapture = 1\n')

    const outcome = reconcile(enf, root)
    expect(outcome.changed.length).toBe(1)
  })

  it('reports a clean tree as clean (no false positives, no diagnostic)', () => {
    const { root } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })

    const outcome = reconcile(enf, root)
    expect(outcome.changed).toEqual([])
    expect(outcome.deleted).toEqual([])
    expect(outcome.diagnostic).toBeUndefined()
  })

  it('catches dirty-at-capture content restored to Git-clean contents', () => {
    const { root, file } = tempGitRepo()
    outOfBandEdit(file, 'export const uncommitted = 2\n')
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })
    outOfBandEdit(file, 'export const original = 1\n')
    const outcome = reconcile(enf, root)
    expect(outcome.degraded).toBe(false)
    expect(outcome.changed).toHaveLength(1)
    expect(enf.state.dirtyFiles.size).toBeGreaterThan(0)
  })

  it('treats deletion as a distinct outcome — dropped from the baseline, never dirty', () => {
    const { root, file } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })

    rmSync(file)

    const outcome = reconcile(enf, root)
    expect(outcome.changed).toEqual([])
    expect(outcome.deleted.length).toBe(1)
    expect(outcome.deleted[0]).toBe('tracked.ts')
    expect(enf.state.dirtyFiles.size).toBe(0)
    expect(outcome.diagnostic).toContain('deleted')
    // Second reconcile: the deletion is not re-reported (no livelock).
    const again = reconcile(enf, root)
    expect(again.deleted).toEqual([])
  })

  it('never silently passes when no baseline was captured', () => {
    const { root } = tempGitRepo()
    const enf = enforcementForCheckpoint(
      groundedAgentState().groundingCheckpoint!,
    )
    // No captureWorktreeBaseline call — the capture never ran.

    const outcome = reconcile(enf, root)
    expect(outcome.unverifiable).toBe(true)
    expect(outcome.diagnostic).toContain('no baseline was captured')
  })

  it('never silently passes when capture recorded unavailable (git + walk both failed)', () => {
    const { root } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    checkpoint.worktreeBaseline = {}
    checkpoint.worktreeBaselineRoot = root
    checkpoint.worktreeBaselineMethod = 'unavailable'
    checkpoint.worktreeBaselineCapturedAt = Date.now()

    const outcome = reconcile(enf, root)
    expect(outcome.unverifiable).toBe(true)
    expect(outcome.diagnostic).toContain('baseline capture failed')
  })

  it('a tracked write through the gate is NOT flagged (dirtyFiles satisfies reconciliation)', () => {
    const { root, file } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint)
    captureWorktreeBaseline({ checkpoint, repoRoot: root })

    // The sanctioned route: read, then write through the tool pipeline.
    enf.beforeToolCall({
      toolName: 'read_files',
      input: { paths: [file] },
      agentId: 'main',
    })
    enf.afterToolCall({
      toolName: 'write_file',
      input: { path: file },
      result: {},
      writtenContent: 'export const throughTheGate = 3\n',
      writeSucceeded: true,
    })

    const outcome = reconcile(enf, root)
    expect(outcome.changed).toEqual([])
  })
})

describe('turn-end integration (evaluateTurnEndImpl)', () => {
  it('blocks turn end when an out-of-band mutation is unaccounted (strict)', () => {
    const { root, file } = tempGitRepo()
    const checkpoint = groundedAgentState().groundingCheckpoint!
    const enf = enforcementForCheckpoint(checkpoint, 'strict')
    captureWorktreeBaseline({ checkpoint, repoRoot: root })
    outOfBandEdit(file, 'export const mutated = 9\n')

    // process.cwd() is NOT the temp repo, so simulate the pipeline's call by
    // reconciling against the temp repo root and merging, then evaluating.
    const outcome = reconcileWorktree({
      checkpoint,
      repoRoot: root,
      dirtyFiles: enf.state.dirtyFiles,
    })
    expect(outcome.changed.length).toBe(1)
    // The merged dirty file makes Law 15 block (no verification credit).
    expect(enf.evaluateTurnEnd().blocked).toBe(true)
  })

  it(
    'advances the baseline over verified paths against the CAPTURED root, ' +
      'never re-flagging verified work (FID-2026-1002-005)',
    () => {
      const { root, file } = tempGitRepo()
      const checkpoint = groundedAgentState().groundingCheckpoint!
      const enf = enforcementForCheckpoint(checkpoint, 'strict')
      captureWorktreeBaseline({ checkpoint, repoRoot: root })

      // Gated write: Law 8 intent first (strict), then the Law 1 read, then
      // the write itself. bun test's cwd is the workspace — NOT the temp
      // capture root — which is exactly the drift the advance leg must
      // survive.
      enf.beforeToolCall({
        toolName: 'write_todos',
        input: { todos: [{ task: 'edit tracked file', completed: false }] },
        agentId: 'main',
      })
      enf.beforeToolCall({
        toolName: 'read_files',
        input: { paths: [file] },
        agentId: 'main',
      })
      enf.afterToolCall({
        toolName: 'write_file',
        input: { path: file },
        result: {},
        writtenContent: 'const edited = 1\n',
        writeSucceeded: true,
      })
      // Green verification run: Law 3 credit for the dirty file.
      enf.afterToolCall({
        toolName: 'run_terminal_command',
        input: { command: 'bun run typecheck' },
        result: { text: 'ok' },
        commandSucceeded: true,
      })

      // First turn end: the baseline must absorb the verified content
      // against the CAPTURED root (the old code advanced against cwd and
      // silently skipped the path).
      expect(enf.evaluateTurnEnd().blocked).toBe(false)
      const verifiedHash = hashFile(file)
      if (!verifiedHash) throw new Error('fixture file hash unavailable')
      expect(checkpoint.worktreeBaseline?.['tracked.ts']).toBe(verifiedHash)

      // Second turn end: reconciliation against the captured root is clean —
      // verified content is never re-flagged.
      expect(enf.evaluateTurnEnd().blocked).toBe(false)
    },
  )
})
