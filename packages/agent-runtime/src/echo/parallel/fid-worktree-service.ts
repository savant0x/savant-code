/** Shared host entry point for the tool and operator CLI (FID-2026-1017-007). */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  statSync,
} from 'node:fs'
import path from 'node:path'

import { fidWorktreeInputSchema } from '@savant-code/common/tools/params/tool/fid-worktree'

import {
  disposeFidWorktree,
  listFidWorktrees,
  provisionFidWorktree,
} from './fid-worktree'
import {
  buildFidWorktreeEnvironment,
  snapshotFidWorktreeGraph,
} from './fid-worktree-environment'
import {
  defaultGitRunner,
  fidWorktreePath,
  pathCompareKey,
} from './fid-worktree-git'
import { inspectFidWorktrees } from './fid-worktree-list'
import { mergeFidWorktree } from './fid-worktree-merge'

import type {
  FidWorktreeInput,
  FidWorktreeResult,
} from '@savant-code/common/tools/params/tool/fid-worktree'

/** Fail closed on redirected managed roots before any recursive lifecycle IO. */
function safeHostRoot(repoRoot: string): boolean {
  const gitRoot = path.join(repoRoot, '.git')
  if (!existsSync(gitRoot) || !statSync(gitRoot).isDirectory()) return false
  for (const suffix of ['', '.savant', '.savant/worktrees']) {
    const target = path.resolve(repoRoot, suffix)
    if (
      existsSync(target) &&
      pathCompareKey(realpathSync(target)) !== pathCompareKey(target)
    )
      return false
  }
  const root = defaultGitRunner(['rev-parse', '--show-toplevel'], repoRoot)
  return (
    root.status === 0 &&
    pathCompareKey(root.stdout.trim()) === pathCompareKey(repoRoot)
  )
}

function isConverged(repoRoot: string, fidId: string): boolean {
  const directory = path.join(repoRoot, 'dev', 'fids')
  if (!existsSync(directory)) return false
  const candidates = readdirSync(directory).filter(
    (name) => name.startsWith(`${fidId}-`) && name.endsWith('.md'),
  )
  return (
    candidates.length === 1 &&
    /^\*\*Status:\*\* converged\s*$/m.test(
      readFileSync(path.join(directory, candidates[0]!), 'utf8'),
    )
  )
}

/** Cross-process lock; stale locks refuse with a named recovery, never auto-delete. */
export async function runFidWorktreeAction(
  repo: string,
  input: FidWorktreeInput,
): Promise<FidWorktreeResult> {
  const repoRoot = path.resolve(repo)
  let locked = false
  const lock = path.join(repoRoot, '.savant', 'fid-worktree.lock')
  try {
    if (!fidWorktreeInputSchema.safeParse(input).success)
      return {
        ok: false,
        reason: 'invalid-input',
        detail: 'Invalid action or FID id',
      }
    if (!safeHostRoot(repoRoot))
      return {
        ok: false,
        reason: 'unsafe-root',
        detail:
          'Use the primary repository root with no redirected managed directories',
      }
    if (input.action === 'list') return inspectFidWorktrees({ repoRoot })
    const lanePath = fidWorktreePath(repoRoot, input.fid_id)
    if (
      !lanePath ||
      (existsSync(lanePath) &&
        pathCompareKey(realpathSync(lanePath)) !==
          pathCompareKey(path.resolve(lanePath)))
    )
      return {
        ok: false,
        reason: 'unsafe-root',
        detail: 'Managed lane path is redirected',
      }
    mkdirSync(path.dirname(lock), { recursive: true })
    try {
      mkdirSync(lock)
      locked = true
    } catch {
      return {
        ok: false,
        reason: 'busy',
        detail:
          'FID lifecycle lock held. Retry; after a crashed host, inspect and remove only the empty .savant/fid-worktree.lock directory.',
      }
    }
    if (input.action === 'create') {
      if (!isConverged(repoRoot, input.fid_id))
        return {
          ok: false,
          reason: 'not-converged',
          detail: 'Create requires exactly one active converged FID',
        }
      const ignored = defaultGitRunner(
        ['check-ignore', '-q', '.savant/worktrees/'],
        repoRoot,
      )
      if (ignored.status !== 0)
        return {
          ok: false,
          reason: 'not-ignored',
          detail: 'Ignore .savant/ before provisioning managed worktrees',
        }
      const branch = defaultGitRunner(
        ['symbolic-ref', '--short', 'HEAD'],
        repoRoot,
      )
      if (branch.status !== 0 || branch.stdout.trim() !== 'main')
        return {
          ok: false,
          reason: 'wrong-branch',
          detail: 'Create lanes from main',
        }
      const result = provisionFidWorktree({ repoRoot, fidId: input.fid_id })
      if (!result.ok) return result
      try {
        buildFidWorktreeEnvironment(result.record)
        snapshotFidWorktreeGraph(repoRoot, result.record)
      } catch {
        const cleanup = disposeFidWorktree({ repoRoot, fidId: input.fid_id })
        return {
          ok: false,
          reason: 'environment-failed',
          detail: cleanup.removed
            ? 'Could not initialize isolated lane environment/graph; provisioning rolled back'
            : 'Lane environment/graph initialization failed and cleanup needs inspection',
          warnings: cleanup.warnings,
        }
      }
      return result
    }
    if (input.action === 'merge')
      return await mergeFidWorktree({ repoRoot, fidId: input.fid_id })
    const lane = listFidWorktrees({ repoRoot }).find(
      (item) => item.record.fidId === input.fid_id,
    )
    if (!lane)
      return {
        ok: false,
        reason: 'not-managed',
        detail: 'No managed FID worktree to dispose',
      }
    if (lane.dirty && !input.discard_changes)
      return {
        ok: false,
        reason: 'dirty',
        detail: 'Commit lane changes or explicitly authorize discard_changes',
      }
    const result = disposeFidWorktree({ repoRoot, fidId: input.fid_id })
    return { ok: result.removed, ...result }
  } catch {
    return {
      ok: false,
      reason: 'io-failed',
      detail:
        'FID worktree operation failed; inspect lane and git registration before retrying',
    }
  } finally {
    if (locked) {
      try {
        rmdirSync(lock)
      } catch {
        // Preserve a stale lock rather than deleting an unexpected occupant.
        // The next action reports the explicit busy/recovery result.
        process.emitWarning(
          'FID lifecycle lock could not be released; inspect .savant/fid-worktree.lock before retrying.',
        )
      }
    }
  }
}
