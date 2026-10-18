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

import type { GitRunner } from './fid-worktree-git'
import type {
  FidWorktreeInput,
  FidWorktreeResult,
} from '@savant-code/common/tools/params/tool/fid-worktree'

/**
 * Bounded retry ONLY for a git process that could not run (`status: null` from
 * a spawn failure or the timeout). A non-null status is a real answer — git ran
 * and either refused or reported a root — so retrying it cannot change the
 * verdict. FID-2026-1017-012: without this split a transient spawn failure and
 * a genuinely different root produced the same `unsafe-root` refusal.
 */
function resolveGitTopLevel(repoRoot: string, run: GitRunner): string | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    const root = run(['rev-parse', '--show-toplevel'], repoRoot)
    if (root.status === 0) return root.stdout.trim()
    if (root.status !== null) return null
  }
  return null
}

/** Fail closed on redirected managed roots before any recursive lifecycle IO. */
export function safeHostRoot(
  repoRoot: string,
  run: GitRunner = defaultGitRunner,
): boolean {
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
  const root = resolveGitTopLevel(repoRoot, run)
  return root !== null && pathCompareKey(root) === pathCompareKey(repoRoot)
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
    // FID-2026-1017-014: the flat schema cannot narrow `fid_id` by action, so
    // the required field is asserted here before any path is derived from it.
    const fidId = input.fid_id
    if (fidId === undefined)
      return {
        ok: false,
        reason: 'invalid-input',
        detail: 'Invalid action or FID id',
      }
    const lanePath = fidWorktreePath(repoRoot, fidId)
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
          'FID lifecycle lock unavailable. A lifecycle writer may still be active; retry after it finishes. After a host crash, confirm no lifecycle writer remains before inspecting .savant/fid-worktree.lock. Remove only a confirmed abandoned, empty directory.',
      }
    }
    if (input.action === 'create') {
      if (!isConverged(repoRoot, fidId))
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
      const result = provisionFidWorktree({ repoRoot, fidId })
      if (!result.ok) return result
      try {
        buildFidWorktreeEnvironment(result.record)
        snapshotFidWorktreeGraph(repoRoot, result.record)
      } catch {
        const cleanup = disposeFidWorktree({ repoRoot, fidId })
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
      return await mergeFidWorktree({ repoRoot, fidId })
    const lane = listFidWorktrees({ repoRoot }).find(
      (item) => item.record.fidId === fidId,
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
    const result = disposeFidWorktree({ repoRoot, fidId })
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
