/**
 * Law 15 git enumeration primitives (FID-2026-1006-004 step 6). Extracted from
 * `worktree-capture.ts` for the 300-line quality cap, and because capture and
 * reconcile share the two budget constants and the retry policy.
 *
 * Both helpers previously classified ANY `spawnSync` error as "git is
 * unavailable". A spurious immediate `ETIMEDOUT` was measured (13 ms against a
 * 500 ms budget) for a command that returns in ~110 ms, with the immediately
 * following identical spawn succeeding both times — i.e. a transient failure
 * was reported as a permanent one, and the resulting advisory read as noise.
 * `isSpuriousTimeout` recognises that class on a provable signal (the elapsed
 * time is a small fraction of the timeout the call was given) and the spawn is
 * retried ONCE; every other failure path stays fail-closed.
 */
import { spawnSync } from 'node:child_process'

/** Full initialization is one-time IO; the 500 ms limit applies at turn end. */
export const CAPTURE_BUDGET_MS = 5_000

/** Turn-end reconciliation budget (operator-confirmed, Q5-A: 500 ms). */
export const RECONCILE_BUDGET_MS = 500

/**
 * A timeout this far below the budget the call was given cannot be the command
 * exhausting that budget — the process died for another reason, so the error
 * is not evidence that git is unavailable.
 */
export const SPURIOUS_TIMEOUT_RATIO = 0.25

/** One raw `spawnSync` attempt: what the process said, and how long it took. */
export type GitSpawnAttempt = {
  status: number | null
  stdout: string
  errorCode?: string
  elapsedMs: number
}

/** The single mutable boundary (injected in tests as a fault-injection seam). */
export type GitSpawnAttemptFn = (
  args: readonly string[],
  repoRoot: string,
  budgetMs: number,
) => GitSpawnAttempt

/** A completed spawn policy run: the last attempt, plus whether it retried. */
export type GitSpawnResult = GitSpawnAttempt & { retried: boolean }

/**
 * Pure decision predicate — no clock read. A timeout is provably spurious when
 * the process reported `ETIMEDOUT` after a small fraction of the time it was
 * allowed, e.g. 13 ms against a 500 ms budget (spurious) versus 500 ms against
 * a 500 ms budget (a real budget exhaustion). `timeoutMs <= 0` disables the
 * timeout entirely, so it can never be provably spurious.
 */
export function isSpuriousTimeout(params: {
  errorCode?: string
  elapsedMs: number
  timeoutMs: number
}): boolean {
  const { errorCode, elapsedMs, timeoutMs } = params
  if (errorCode !== 'ETIMEDOUT') return false
  if (timeoutMs <= 0) return false
  return elapsedMs < timeoutMs * SPURIOUS_TIMEOUT_RATIO
}

/**
 * The errno code of a failed spawn, read without a type assertion (`Error`
 * carries no `code`, so the property is narrowed structurally).
 */
function errnoCode(error: Error | undefined): string | undefined {
  if (error && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return undefined
}

/** The production spawn attempt: the only place `spawnSync` is called. */
export function attemptGitSpawn(
  args: readonly string[],
  repoRoot: string,
  budgetMs: number,
): GitSpawnAttempt {
  const startedAt = Date.now()
  const result = spawnSync('git', [...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: budgetMs,
  })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    errorCode: errnoCode(result.error),
    elapsedMs: Date.now() - startedAt,
  }
}

/**
 * Run one git enumeration under the retry-once policy: a provably spurious
 * timeout is retried a single time, because one transient spawn error must not
 * be reported as "git is unavailable". A real failure is never retried.
 */
export function runGitSpawn(
  args: readonly string[],
  repoRoot: string,
  budgetMs: number,
  attempt: GitSpawnAttemptFn = attemptGitSpawn,
): GitSpawnResult {
  const first = attempt(args, repoRoot, budgetMs)
  if (
    !isSpuriousTimeout({
      errorCode: first.errorCode,
      elapsedMs: first.elapsedMs,
      timeoutMs: budgetMs,
    })
  ) {
    return { ...first, retried: false }
  }
  return { ...attempt(args, repoRoot, budgetMs), retried: true }
}

/**
 * Human-readable failure evidence for the degrade diagnostics (Law 8 — the
 * degradation path needs the same specificity as the success path).
 */
export function describeGitFailure(result: GitSpawnResult): string {
  const cause =
    result.errorCode ??
    (result.status === null ? 'no exit' : `exit ${result.status}`)
  return `${cause} after ${result.elapsedMs}ms${result.retried ? ' (after one retry)' : ''}`
}

/**
 * Run `git ls-files -z --cached --others --exclude-standard`. Returns null
 * when git itself failed — the caller must distinguish "empty repo" from
 * "cannot enumerate" (never silently equal).
 */
export function runGitFileList(
  repoRoot: string,
  budgetMs: number = CAPTURE_BUDGET_MS,
  attempt?: GitSpawnAttemptFn,
): string[] | null {
  const result = runGitSpawn(
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    repoRoot,
    budgetMs,
    attempt,
  )
  if (result.status !== 0) return null
  return result.stdout.split('\0').filter((p) => p.length > 0)
}

/**
 * Run `git status --porcelain=v1 -z --untracked-files=all` — the CHANGED set
 * (staged, worktree-modified, renamed, deleted, untracked). Cheap (git's index
 * diff), unlike a full-inventory listing. Exit 1 is a normal dirty-tree
 * result, not a failure; any other non-zero status means git did not answer
 * and `paths` is null. Rename records carry the target as a separate token —
 * both endpoints are returned (the old path hash-null-skips, the new path
 * reconciles).
 */
export function runGitStatusList(
  repoRoot: string,
  budgetMs: number = RECONCILE_BUDGET_MS,
  attempt?: GitSpawnAttemptFn,
): GitSpawnResult & { paths: string[] | null } {
  const result = runGitSpawn(
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    repoRoot,
    budgetMs,
    attempt,
  )
  if (result.status !== 0 && result.status !== 1) {
    return { ...result, paths: null }
  }
  const paths: string[] = []
  let expectRenameTarget = false
  for (const token of result.stdout.split('\0')) {
    if (token.length === 0) continue
    if (expectRenameTarget) {
      paths.push(token)
      expectRenameTarget = false
      continue
    }
    const x = token[0]
    const y = token[1]
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') {
      expectRenameTarget = true
    }
    paths.push(token.slice(3))
  }
  return { ...result, paths }
}
