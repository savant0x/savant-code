/**
 * FID-2026-1017-007 — the git seam and path vocabulary for FID worktrees.
 *
 * Naming rule (this FID): `worktree-*` in `echo/enforcement/` means the
 * **working tree** you are in (Law 15 baseline/reconcile). A **FID worktree**
 * is a linked checkout created by `git worktree add`, and every module for it
 * is `fid-worktree-*` under `echo/parallel/`. The two never share a name.
 *
 * The path is derived from the FID id, never supplied by a caller, so an id
 * cannot traverse out of the managed root. The root is `.savant/worktrees`,
 * under the already-ignored `.savant/` entry (`.gitignore:107`).
 */
import { spawnSync } from 'node:child_process'

/** Managed root, relative to the repository root. */
export const FID_WORKTREE_ROOT = '.savant/worktrees'

/** Records live OUTSIDE the lane so a crashed lane cannot lose its identity. */
export const FID_WORKTREE_RECORDS = `${FID_WORKTREE_ROOT}/.records`

/** Active-lane ceiling: each lane still copies working files and caches. */
export const DEFAULT_MAX_FID_WORKTREES = 4

const FID_PATTERN = /^FID-\d{4}-\d{4}-\d{3}$/

export type GitResult = {
  status: number | null
  stdout: string
  stderr: string
}

/** Injected git execution: argv only, never a shell string. */
export type GitRunner = (args: readonly string[], cwd: string) => GitResult

/** The production runner: one `spawnSync`, bounded, argv-shaped. */
export const defaultGitRunner: GitRunner = (args, cwd) => {
  const result = spawnSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
  })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

export function isFidId(value: string): boolean {
  return FID_PATTERN.test(value)
}

/** `savant/FID-2026-1017-007` — one branch per lane, derived from the id. */
export function fidBranchName(fidId: string): string {
  return `savant/${fidId}`
}

/** `.savant/worktrees/<fidId>` (posix, relative). */
export function fidWorktreeRelativePath(fidId: string): string {
  return `${FID_WORKTREE_ROOT}/${fidId}`
}

/** Absolute lane path; returns null for an invalid id rather than joining it. */
export function fidWorktreePath(
  repoRoot: string,
  fidId: string,
): string | null {
  if (!isFidId(fidId)) return null
  return `${repoRoot.replace(/[\\/]+$/, '')}/${fidWorktreeRelativePath(fidId)}`
}

/** `<records>/<fidId>.json` (posix, relative to the repository root). */
export function fidWorktreeRecordPath(fidId: string): string {
  return `${FID_WORKTREE_RECORDS}/${fidId}.json`
}

export function runGit(
  run: GitRunner,
  args: readonly string[],
  cwd: string,
): GitResult {
  return run(args, cwd)
}

/**
 * Comparison key for paths that cross the git/Node boundary: git prints
 * forward-slash absolute paths, `node:path` produces backslashes on Windows,
 * and Windows paths are case-insensitive. Comparing raw strings silently
 * reports a registered lane as unregistered (caught by the real-git probe).
 */
export function pathCompareKey(target: string): string {
  const posix = target.replace(/\\/g, '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? posix.toLowerCase() : posix
}

/** One-line failure detail: stderr, else the exit status. */
export function describeGitResult(result: GitResult): string {
  const stderr = result.stderr.trim()
  if (stderr) return stderr
  return result.status === null ? 'no exit status' : `exit ${result.status}`
}
