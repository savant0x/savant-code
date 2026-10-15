/**
 * Law 15 worktree-baseline capture (FID-2026-1001-003 step 2; split baseline
 * FID-2026-1006-004). The baseline lives on the durable grounding checkpoint —
 * deliberately NOT on `EnforcementState`, whose state loss (FID-2026-1001-003
 * Finding 2, resolved by step 3) would fail the backstop OPEN and invisibly.
 *
 * The baseline does two jobs, and this module no longer conflates them:
 *
 * - **inventory** (`worktreeBaselinePaths`) — every enumerated candidate path,
 *   which is what lets a vanished file be noticed. Cheap: `git ls-files` names
 *   5,459 paths in ~0.15 s with no per-file IO.
 * - **content record** (`worktreeBaseline`) — sha256 per path, which is what
 *   lets a changed file be noticed. Load-bearing only for paths the candidate
 *   loop must EXEMPT: files that were already dirty at capture (they would
 *   otherwise be flagged unaccounted every turn). Everything else rides on the
 *   change enumeration, where a candidate absent from the map is unaccounted.
 *
 * Before the split, capture content-hashed the full inventory inside
 * `CAPTURE_BUDGET_MS`, so its cost scaled with repository size; on this
 * repository the blow was refused by design and stamped `unavailable`, which
 * disarmed the backstop for the life of the session. Capture cost is now a
 * function of what has to be hashed, not of how many files exist.
 *
 * Without git there is no oracle naming the dirty subset, so the walk branch
 * keeps hashing its full inventory (the map therefore still covers the
 * inventory there) inside the same one-time budget and refuses if it cannot
 * complete — an already-degraded branch must not be degraded further. Half-
 * captured baselines fail open, so a budget blow is refused entirely, recorded
 * as `unavailable` with the leg that failed, and reconciled as "cannot verify"
 * explicitly — never silently passed. A refusal is recoverable (bounded
 * recapture), not terminal for the session.
 */
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { canonicalizePath } from '../path-canonicalization'
import { classifyMutation, isWriteTool } from './helpers'
import {
  CAPTURE_BUDGET_MS,
  runGitFileList,
  runGitStatusList,
  type GitSpawnAttemptFn,
} from './worktree-git'
import { walkCandidates } from './worktree-walk'

import type { GroundingCheckpoint } from '@savant-code/common/types/session-state'

export { CAPTURE_BUDGET_MS }

/** Over this size a file is skipped (accepted limit — stated in the FID). */
export const MAX_HASHABLE_FILE_BYTES = 2 * 1024 * 1024

/** Bounded recapture policy for a refused baseline (step 7). */
export const MAX_CAPTURE_RETRIES = 2

/** One recapture per minute is enough to recover a transient refusal. */
export const CAPTURE_RETRY_COOLDOWN_MS = 60_000

/**
 * Pure recapture gate — no clock read (the caller supplies `now`). A baseline
 * is retried only when it is refused (`unavailable`), the bounded retry count
 * is not spent, and the cooldown since the last attempt has elapsed. A live
 * baseline (`git` / `walk`) is never re-captured: capture is one-time IO.
 */
export function shouldRetryCapture(params: {
  method: GroundingCheckpoint['worktreeBaselineMethod']
  retries: number
  lastAttemptAtMs: number | null | undefined
  now: number
  cooldownMs?: number
  maxRetries?: number
}): boolean {
  const { method, retries, lastAttemptAtMs, now } = params
  const cooldownMs = params.cooldownMs ?? CAPTURE_RETRY_COOLDOWN_MS
  const maxRetries = params.maxRetries ?? MAX_CAPTURE_RETRIES
  if (method !== 'unavailable') return false
  if (retries >= maxRetries) return false
  if (lastAttemptAtMs == null) return true
  return now - lastAttemptAtMs >= cooldownMs
}

/**
 * Capture the session baseline. Git mode enumerates the full inventory and
 * content-hashes only the initially-dirty set; walk mode hashes its full walk
 * inventory. A capture that cannot complete inside `budgetMs` is refused
 * entirely (never half-captured), and the failing leg is recorded durably so
 * the turn-end advisory can name it instead of emitting one catch-all
 * sentence. An empty captured baseline fails CLOSED at reconciliation.
 */
export function captureWorktreeBaseline(params: {
  checkpoint: GroundingCheckpoint
  repoRoot: string
  budgetMs?: number
  attempt?: GitSpawnAttemptFn
}): void {
  const { checkpoint, repoRoot, attempt } = params
  const budgetMs = params.budgetMs ?? CAPTURE_BUDGET_MS
  const startedAt = Date.now()

  let method: 'git' | 'walk' | 'unavailable' = 'unavailable'
  let failure: GroundingCheckpoint['worktreeBaselineFailure']
  let inventory: string[] = []
  let hashTargets: string[] = []
  let dirtyPaths: string[] | undefined

  const listed = runGitFileList(repoRoot, budgetMs, attempt)
  if (listed !== null) {
    method = 'git'
    inventory = listed.map(normalizeBaselinePath)
    const remainingBudget = budgetMs - (Date.now() - startedAt)
    if (remainingBudget <= 0) {
      // Nothing is left to hash: the hashing leg — not the dirty set — is the
      // leg that could not run.
      method = 'unavailable'
      failure = 'hash-budget'
    } else {
      const status = runGitStatusList(repoRoot, remainingBudget, attempt)
      if (status.paths === null) {
        // The reduced map makes an undefined dirty set fail OPEN (the candidate
        // seed collapses and clean files become unexaminable while `method`
        // still reads 'git'), so capture must refuse itself here.
        method = 'unavailable'
        failure = 'dirty-set'
      } else {
        dirtyPaths = status.paths
        hashTargets = [
          ...new Set(status.paths.map((p) => normalizeBaselinePath(p))),
        ]
      }
    }
  } else {
    try {
      inventory = walkCandidates(repoRoot, repoRoot, startedAt, budgetMs).map(
        normalizeBaselinePath,
      )
      method = 'walk'
      hashTargets = [...inventory]
    } catch {
      method = 'unavailable'
      failure = 'enumerate'
      inventory = []
    }
  }

  const baseline: Record<string, string> = {}
  const skipped: string[] = []
  if (method !== 'unavailable') {
    const hashingLeg = method
    for (const relPath of hashTargets) {
      if (Date.now() - startedAt >= budgetMs) {
        // Half-captured baselines fail open — refuse the capture entirely.
        method = 'unavailable'
        failure = hashingLeg === 'walk' ? 'walk-budget' : 'hash-budget'
        for (const key of Object.keys(baseline)) delete baseline[key]
        skipped.length = 0
        break
      }
      const hash = hashFile(join(repoRoot, relPath))
      if (hash === null) {
        skipped.push(relPath)
        continue
      }
      baseline[relPath] = hash
    }
  }

  const refused = method === 'unavailable'
  checkpoint.worktreeBaseline = refused ? {} : baseline
  checkpoint.worktreeBaselinePaths = refused ? [] : inventory
  checkpoint.worktreeBaselineRoot = repoRoot
  checkpoint.worktreeBaselineMethod = method
  checkpoint.worktreeBaselineCapturedAt = startedAt
  checkpoint.worktreeBaselineSkipped = [...skipped]
  checkpoint.worktreeBaselineDirtyPaths =
    method === 'git' ? (dirtyPaths ?? undefined) : undefined
  checkpoint.worktreeBaselineFailure = refused
    ? (failure ?? 'enumerate')
    : undefined
  checkpoint.worktreeBaselineRetries = refused
    ? (checkpoint.worktreeBaselineRetries ?? 0) + 1
    : 0
}

/**
 * Lazy capture hook for the tool pipeline: captures the baseline on the first
 * tool call that can reach the worktree — a write-path tool OR a call the
 * step-1 classifier marks mutating (the first call being `sed -i …` must NOT
 * defer capture to the reconciliation, which needs this baseline to have
 * anything to diff against). Terminal tools (`end_turn`) never reach the
 * worktree but classify non-mutating, so they stay free. Pure-read sessions
 * never pay the capture cost. No checkpoint (SDK embedders) → no-op (CLI
 * sessions always carry one).
 *
 * A REFUSED baseline is not terminal: `shouldRetryCapture` gates a bounded
 * recapture so one transient failure no longer disarms the backstop for the
 * remainder of the session.
 */
export function maybeCaptureWorktreeBaseline(
  checkpoint: GroundingCheckpoint | undefined,
  toolName: string,
  repoRoot: string,
  input?: Record<string, unknown>,
): void {
  if (!checkpoint) return
  if (checkpoint.worktreeBaselineCapturedAt != null) {
    const retry = shouldRetryCapture({
      method: checkpoint.worktreeBaselineMethod,
      retries: checkpoint.worktreeBaselineRetries ?? 0,
      lastAttemptAtMs: checkpoint.worktreeBaselineCapturedAt,
      now: Date.now(),
    })
    if (!retry) return
  }
  const mutates =
    input !== undefined && classifyMutation({ toolName, params: input }).mutates
  if (!isWriteTool(toolName) && !mutates) return
  captureWorktreeBaseline({ checkpoint, repoRoot })
}

/**
 * Advance the baseline over a just-verified batch (called at a CLEAN turn
 * end, before `resetForNewTurn` clears it). Every path in the batch passed
 * Law 15, so its current content is "accounted" — recorded into the baseline
 * so later turns never re-flag it. Verified-only (never the whole dirty
 * batch): a hybrid-mode unverified terminal mutation must stay outside the
 * baseline and re-surface next turn, never be silently absorbed.
 *
 * A path created after capture is recorded in the map only — never in the
 * frozen inventory — so its later deletion stays visible to the baseline's
 * deletion source (step 4 term (iii)).
 */
export function advanceWorktreeBaseline(params: {
  checkpoint: GroundingCheckpoint | undefined
  repoRoot: string
  paths: string[]
}): void {
  const { checkpoint, repoRoot, paths } = params
  if (!checkpoint || checkpoint.worktreeBaselineCapturedAt == null) return
  if (checkpoint.worktreeBaselineMethod === 'unavailable') return
  if (!checkpoint.worktreeBaseline) checkpoint.worktreeBaseline = {}
  const baseline = checkpoint.worktreeBaseline
  const rootCanonical = canonicalizePath(repoRoot)
  for (const path of paths) {
    const absPath = canonicalizePath(path)
    if (!absPath.startsWith(`${rootCanonical}/`)) continue
    const relPath = absPath.slice(rootCanonical.length + 1)
    const hash = hashFile(absPath)
    if (hash === null) {
      delete baseline[relPath]
      continue
    }
    baseline[relPath] = hash
  }
}

export function hashFile(absPath: string): string | null {
  try {
    const stats = statSync(absPath)
    if (!stats.isFile()) return null
    if (stats.size > MAX_HASHABLE_FILE_BYTES) return null
    return createHash('sha256').update(readFileSync(absPath)).digest('hex')
  } catch {
    return null
  }
}

/** Repo-relative, forward-slash form for baseline keys. */
export function normalizeBaselinePath(relPath: string): string {
  return relPath.replaceAll('\\', '/')
}
