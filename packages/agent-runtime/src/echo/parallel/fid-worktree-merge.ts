/** FID-2026-1017-007: refusal-only integration, never conflict resolution. */
import { refreshMergedFidGraph } from './fid-worktree-environment'
import { defaultGitRunner, describeGitResult } from './fid-worktree-git'
import { isRegisteredFidWorktree } from './fid-worktree-jurisdiction'
import { findFidWorktreeRecord } from './fid-worktree-record'

import type { GitRunner } from './fid-worktree-git'

export type MergeOutcome =
  | { ok: true; head: string; warnings: string[] }
  | {
      ok: false
      reason:
        | 'not-managed'
        | 'wrong-branch'
        | 'dirty'
        | 'diverged'
        | 'conflict'
        | 'git-failed'
      detail: string
    }

/** Caller holds the lifecycle lock across this operation and graph refresh. */
export async function mergeFidWorktree(options: {
  repoRoot: string
  fidId: string
  run?: GitRunner
  refreshGraph?: (repoRoot: string) => Promise<void>
}): Promise<MergeOutcome> {
  const {
    repoRoot,
    fidId,
    run = defaultGitRunner,
    refreshGraph = refreshMergedFidGraph,
  } = options
  const record = findFidWorktreeRecord(repoRoot, fidId)
  if (!record || !isRegisteredFidWorktree(repoRoot, record)) {
    return {
      ok: false,
      reason: 'not-managed',
      detail: 'No registered FID worktree',
    }
  }
  const rootBranch = run(['symbolic-ref', '--short', 'HEAD'], repoRoot)
  const laneBranch = run(['symbolic-ref', '--short', 'HEAD'], record.path)
  if (
    rootBranch.status !== 0 ||
    rootBranch.stdout.trim() !== 'main' ||
    laneBranch.status !== 0 ||
    laneBranch.stdout.trim() !== record.branch
  ) {
    return {
      ok: false,
      reason: 'wrong-branch',
      detail:
        'Merge requires main and the recorded lane branch to be checked out',
    }
  }
  for (const cwd of [repoRoot, record.path]) {
    const status = run(
      ['status', '--porcelain', '--untracked-files=normal'],
      cwd,
    )
    if (status.status !== 0)
      return {
        ok: false,
        reason: 'git-failed',
        detail: describeGitResult(status),
      }
    if (status.stdout.trim())
      return {
        ok: false,
        reason: 'dirty',
        detail: 'Both main and the lane must be clean before merge',
      }
  }
  const head = run(['rev-parse', 'HEAD'], repoRoot)
  const laneHead = run(['rev-parse', 'HEAD'], record.path)
  if (head.status !== 0 || laneHead.status !== 0)
    return {
      ok: false,
      reason: 'git-failed',
      detail: 'Cannot resolve checkout heads',
    }
  // Test against the current HEAD so conflicts are named even on divergence.
  const dryRun = run(
    ['merge-tree', '--write-tree', head.stdout.trim(), laneHead.stdout.trim()],
    repoRoot,
  )
  if (dryRun.status !== 0) {
    return {
      ok: false,
      reason: dryRun.status === 1 ? 'conflict' : 'git-failed',
      detail:
        dryRun.status === 1 ? dryRun.stdout.trim() : describeGitResult(dryRun),
    }
  }
  if (head.stdout.trim() !== record.baseSha) {
    return {
      ok: false,
      reason: 'diverged',
      detail: `main HEAD ${head.stdout.trim()} differs from recorded base ${record.baseSha}`,
    }
  }
  const rechecked = run(['rev-parse', 'HEAD'], repoRoot)
  if (rechecked.status !== 0 || rechecked.stdout.trim() !== record.baseSha) {
    return {
      ok: false,
      reason: 'diverged',
      detail: 'main moved during merge preparation',
    }
  }
  const merged = run(['merge', '--ff-only', laneHead.stdout.trim()], repoRoot)
  if (merged.status !== 0)
    return {
      ok: false,
      reason: 'git-failed',
      detail: describeGitResult(merged),
    }
  const warnings: string[] = []
  try {
    await refreshGraph(repoRoot)
  } catch {
    warnings.push(
      'Merge landed; main graph refresh failed. Run /graph refresh before relying on graph results.',
    )
  }
  return { ok: true, head: laneHead.stdout.trim(), warnings }
}
