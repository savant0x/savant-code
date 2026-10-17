/**
 * FID-2026-1017-007 — FID-bound worktree lifecycle.
 *
 * One converged FID gets one linked checkout under `.savant/worktrees/<fidId>`
 * on branch `savant/<fidId>`, provisioned and disposed by the host. The
 * teardown order is the recorded release-checkout contract: `git worktree
 * remove --force`, verify absence, fall back to a bounded filesystem removal
 * only for survivors, then `git worktree prune`. It is never `rm -rf` first —
 * that ordering produced the orphaned-Temp-worktree incident (git loses the
 * registration while the directory survives, and no git command can clear it).
 *
 * Every git and filesystem call is injected. Cleanup warnings are returned,
 * never thrown: a failed removal must be visible, not fatal.
 */
import path from 'node:path'

import {
  DEFAULT_MAX_FID_WORKTREES,
  defaultGitRunner,
  describeGitResult,
  fidBranchName,
  fidWorktreePath,
  fidWorktreeRelativePath,
  pathCompareKey,
  runGit,
  type GitRunner,
} from './fid-worktree-git'
import {
  activeFidWorktreeRecords,
  deleteFidWorktreeRecord,
  findFidWorktreeRecord,
  readFidWorktreeRecords,
  writeFidWorktreeRecord,
  type FidWorktreeRecord,
  type WorktreeFs,
  defaultWorktreeFs,
} from './fid-worktree-record'

export type { FidWorktreeRecord, WorktreeFs } from './fid-worktree-record'
export {
  FID_WORKTREE_RECORDS,
  FID_WORKTREE_ROOT,
  DEFAULT_MAX_FID_WORKTREES,
  fidBranchName,
  fidWorktreePath,
  fidWorktreeRelativePath,
  isFidId,
} from './fid-worktree-git'

/** Main-checkout dependency directories linked instead of reinstalled. */
const DEPENDENCY_LINK_CANDIDATES = [
  'node_modules',
  'cli/node_modules',
  'common/node_modules',
  'sdk/node_modules',
  'evals/node_modules',
  'desktop/node_modules',
  'packages/agent-runtime/node_modules',
  'packages/code-map/node_modules',
  'packages/knowledge-graph/node_modules',
  'packages/llm-providers/node_modules',
  'packages/database/node_modules',
  'packages/design-systems/node_modules',
  'packages/connectors/node_modules',
]

export type ProvisionOutcome =
  | { ok: true; record: FidWorktreeRecord; warnings: string[] }
  | {
      ok: false
      reason:
        | 'invalid-fid'
        | 'fid-in-use'
        | 'branch-exists'
        | 'cap-exceeded'
        | 'git-failed'
      detail: string
    }

export type ProvisionOptions = {
  repoRoot: string
  fidId: string
  baseRef?: string
  maxActive?: number
  fs?: WorktreeFs
  run?: GitRunner
  now?: () => number
}

function refExists(run: GitRunner, repoRoot: string, ref: string): boolean {
  return (
    runGit(run, ['show-ref', '--verify', '--quiet', ref], repoRoot).status === 0
  )
}

function linkDependencies(
  repoRoot: string,
  lanePath: string,
  fs: WorktreeFs,
): { links: string[]; warnings: string[] } {
  const links: string[] = []
  const warnings: string[] = []
  for (const relative of DEPENDENCY_LINK_CANDIDATES) {
    const source = path.join(repoRoot, relative)
    if (!fs.exists(source)) continue
    const link = path.join(lanePath, relative)
    fs.mkdirp(path.dirname(link))
    if (fs.linkDir(source, link)) links.push(relative)
    else warnings.push(`could not link ${relative} into the FID worktree`)
  }
  return { links, warnings }
}

export function provisionFidWorktree(
  options: ProvisionOptions,
): ProvisionOutcome {
  const { repoRoot, fidId, baseRef = 'HEAD' } = options
  const fs = options.fs ?? defaultWorktreeFs
  const run = options.run ?? defaultGitRunner
  const now = options.now ?? (() => Date.now())
  const maxActive = options.maxActive ?? DEFAULT_MAX_FID_WORKTREES

  const lanePath = fidWorktreePath(repoRoot, fidId)
  if (!lanePath) {
    return {
      ok: false,
      reason: 'invalid-fid',
      detail: `"${fidId}" is not a FID id (expected FID-YYYY-MMDD-NNN)`,
    }
  }
  if (findFidWorktreeRecord(repoRoot, fidId, fs)) {
    return {
      ok: false,
      reason: 'fid-in-use',
      detail: `${fidId} already has a managed FID worktree`,
    }
  }
  if (activeFidWorktreeRecords(repoRoot, fs).length >= maxActive) {
    return {
      ok: false,
      reason: 'cap-exceeded',
      detail: `active FID worktrees are at the cap of ${maxActive}`,
    }
  }

  // Pre-create guard: debris from a crashed run must not block the next one.
  if (fs.exists(lanePath)) {
    disposeFidWorktree({ repoRoot, fidId, fs, run })
    if (fs.exists(lanePath)) {
      return {
        ok: false,
        reason: 'git-failed',
        detail: `debris remains at ${lanePath} after cleanup`,
      }
    }
  }

  const base = runGit(run, ['rev-parse', baseRef], repoRoot)
  if (base.status !== 0) {
    return {
      ok: false,
      reason: 'git-failed',
      detail: `cannot resolve ${baseRef}: ${describeGitResult(base)}`,
    }
  }
  const baseSha = base.stdout.trim()
  const branch = fidBranchName(fidId)
  const branchSha = refExists(run, repoRoot, `refs/heads/${branch}`)
    ? runGit(run, ['rev-parse', `refs/heads/${branch}`], repoRoot).stdout.trim()
    : null
  if (branchSha !== null && branchSha !== baseSha) {
    // A branch that descends from the requested base is a resumable lane (its
    // work is unmerged but not divergent). Only a genuine divergence refuses.
    const descends =
      runGit(run, ['merge-base', '--is-ancestor', baseSha, branchSha], repoRoot)
        .status === 0
    if (!descends) {
      return {
        ok: false,
        reason: 'branch-exists',
        detail: `branch ${branch} has diverged from the requested base ${baseSha}`,
      }
    }
  }

  // A branch that already points at the requested base is reused (the lane was
  // disposed but its branch kept, or a previous lane was merged); only a
  // different base is a refusal.
  const added =
    branchSha === null
      ? runGit(
          run,
          ['worktree', 'add', '-b', branch, lanePath, baseSha],
          repoRoot,
        )
      : runGit(run, ['worktree', 'add', lanePath, branch], repoRoot)
  if (added.status !== 0) {
    return {
      ok: false,
      reason: 'git-failed',
      detail: `git worktree add failed: ${describeGitResult(added)}`,
    }
  }

  const { links, warnings } = linkDependencies(repoRoot, lanePath, fs)
  const record: FidWorktreeRecord = {
    fidId,
    path: lanePath,
    relativePath: fidWorktreeRelativePath(fidId),
    branch,
    baseSha,
    createdAt: new Date(now()).toISOString(),
    dependencyLinks: links,
  }
  writeFidWorktreeRecord(repoRoot, record, fs)

  // Second cap read after the record write: two concurrent provisions can both
  // pass the pre-check, so the loser rolls its lane back instead of leaving an
  // over-cap checkout behind.
  if (activeFidWorktreeRecords(repoRoot, fs).length > maxActive) {
    disposeFidWorktree({ repoRoot, fidId, fs, run })
    return {
      ok: false,
      reason: 'cap-exceeded',
      detail: `active FID worktrees would exceed the cap of ${maxActive}`,
    }
  }

  return { ok: true, record, warnings }
}

export type FidWorktreeListing = {
  record: FidWorktreeRecord
  registered: boolean
  dirty: boolean
}

export function listFidWorktrees(options: {
  repoRoot: string
  fs?: WorktreeFs
  run?: GitRunner
}): FidWorktreeListing[] {
  const fs = options.fs ?? defaultWorktreeFs
  const run = options.run ?? defaultGitRunner
  const listed = runGit(
    run,
    ['worktree', 'list', '--porcelain'],
    options.repoRoot,
  )
  const registered = new Set<string>()
  if (listed.status === 0) {
    for (const line of listed.stdout.split('\n')) {
      if (line.startsWith('worktree '))
        registered.add(pathCompareKey(line.slice(9).trim()))
    }
  }
  return readFidWorktreeRecords(options.repoRoot, fs).map((record) => {
    const status = runGit(run, ['status', '--porcelain'], record.path)
    return {
      record,
      registered: registered.has(pathCompareKey(record.path)),
      dirty: status.status === 0 && status.stdout.trim().length > 0,
    }
  })
}

export type DisposeOutcome = {
  removed: boolean
  warnings: string[]
}

export function disposeFidWorktree(options: {
  repoRoot: string
  fidId: string
  fs?: WorktreeFs
  run?: GitRunner
}): DisposeOutcome {
  const { repoRoot, fidId } = options
  const fs = options.fs ?? defaultWorktreeFs
  const run = options.run ?? defaultGitRunner
  const warnings: string[] = []
  const lanePath = fidWorktreePath(repoRoot, fidId)
  if (!lanePath)
    return { removed: false, warnings: [`invalid FID id "${fidId}"`] }

  const remove = runGit(
    run,
    ['worktree', 'remove', '--force', lanePath],
    repoRoot,
  )
  if (remove.status !== 0 && fs.exists(lanePath)) {
    warnings.push(
      `git worktree remove reported ${describeGitResult(remove)} for ${lanePath}`,
    )
  }
  if (fs.exists(lanePath) && !fs.removeDir(lanePath)) {
    warnings.push(
      `FID worktree survived cleanup: ${lanePath} — remove the directory and re-run`,
    )
    return { removed: false, warnings }
  }

  const pruned = runGit(run, ['worktree', 'prune'], repoRoot)
  if (pruned.status !== 0) {
    warnings.push(`git worktree prune reported ${describeGitResult(pruned)}`)
  }
  deleteFidWorktreeRecord(repoRoot, fidId, fs)
  return { removed: !fs.exists(lanePath), warnings }
}
