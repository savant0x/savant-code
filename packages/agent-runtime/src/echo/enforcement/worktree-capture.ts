/**
 * Law 15 worktree-baseline capture (FID-2026-1001-003 step 2). Extracted
 * from `worktree-reconcile.ts` for the 300-line quality cap; the baseline
 * lives on the durable grounding checkpoint — deliberately NOT on
 * `EnforcementState`, whose state loss (FID-2026-1001-003 Finding 2,
 * resolved by step 3) would fail the backstop OPEN and invisibly.
 *
 * Enumeration: `git ls-files -z --cached --others --exclude-standard` — the
 * full candidate set (tracked + untracked-not-ignored). A porcelain snapshot
 * is wrong for the baseline twice over: a set-difference misses a file dirty
 * at capture AND modified again, and `status --porcelain` lists only CHANGED
 * paths, so a clean-tree capture builds an empty baseline and a deleted
 * committed file becomes invisible. Fallback: the bounded walk in
 * `./worktree-walk`. Half-captured baselines fail open, so a budget blow is
 * refused entirely and recorded as `unavailable` — reconciliation then says
 * "cannot verify" explicitly, never silently passes.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { canonicalizePath } from '../path-canonicalization'
import { classifyMutation, isWriteTool } from './helpers'
import { walkCandidates } from './worktree-walk'

import type { GroundingCheckpoint } from '@savant-code/common/types/session-state'

/** Over this size a file is skipped (accepted limit — stated in the FID). */
export const MAX_HASHABLE_FILE_BYTES = 2 * 1024 * 1024

/** Full initialization is one-time IO; the 500 ms limit applies at turn end. */
export const CAPTURE_BUDGET_MS = 5_000

/**
 * Run `git ls-files -z --cached --others --exclude-standard`. Returns null
 * when git itself failed — the caller must distinguish "empty repo" from
 * "cannot enumerate" (never silently equal).
 */
export function runGitFileList(
  repoRoot: string,
  budgetMs: number = CAPTURE_BUDGET_MS,
): string[] | null {
  try {
    const result = spawnSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: budgetMs,
      },
    )
    if (result.error || result.status !== 0) return null
    return (result.stdout ?? '').split('\0').filter((p) => p.length > 0)
  } catch {
    return null
  }
}

/**
 * Run `git status --porcelain=v1 -z --untracked-files=all` — the CHANGED
 * set (staged, worktree-modified, renamed, deleted, untracked). Cheap
 * (git's index diff), unlike a full-inventory listing. Returns null when
 * git itself failed; exit 1 is a normal dirty-tree result, not a failure.
 * Rename records carry the target as a separate token — both endpoints are
 * returned (the old path hash-null-skips, the new path reconciles).
 */
export function runGitStatusList(
  repoRoot: string,
  budgetMs: number = RECONCILE_BUDGET,
): string[] | null {
  try {
    const result = spawnSync(
      'git',
      ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: budgetMs,
      },
    )
    if (result.error || (result.status !== 0 && result.status !== 1)) {
      return null
    }
    const paths: string[] = []
    let expectRenameTarget = false
    for (const token of (result.stdout ?? '').split('\0')) {
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
    return paths
  } catch {
    return null
  }
}

/** Reconcile budget lives here so capture and advance share the constant. */
const RECONCILE_BUDGET = 500

/**
 * Capture the session baseline: full-inventory candidates, each
 * content-hashed. Captured lazily on the first tracked write-path tool call
 * (never in a state factory — IO there is Law-14-hostile). An empty captured
 * baseline fails CLOSED at reconciliation.
 */
export function captureWorktreeBaseline(params: {
  checkpoint: GroundingCheckpoint
  repoRoot: string
  budgetMs?: number
}): void {
  const { checkpoint, repoRoot } = params
  const budgetMs = params.budgetMs ?? CAPTURE_BUDGET_MS
  const startedAt = Date.now()

  let method: 'git' | 'walk' | 'unavailable' = 'unavailable'
  let candidates: string[] = []
  const listed = runGitFileList(repoRoot, budgetMs)
  if (listed !== null) {
    method = 'git'
    candidates = listed
  } else {
    try {
      candidates = walkCandidates(repoRoot, repoRoot, startedAt, budgetMs)
      method = 'walk'
    } catch {
      method = 'unavailable'
      candidates = []
    }
  }

  const baseline: Record<string, string> = {}
  const skipped: string[] = []
  const remainingBudget = budgetMs - (Date.now() - startedAt)
  const dirtyPaths =
    method === 'git' && remainingBudget > 0
      ? runGitStatusList(repoRoot, remainingBudget)
      : undefined
  if (method === 'git' && dirtyPaths == null) method = 'unavailable'
  if (method !== 'unavailable') {
    for (const relPath of candidates) {
      if (Date.now() - startedAt >= budgetMs) {
        // Half-captured baselines fail open — refuse the capture entirely.
        method = 'unavailable'
        for (const key of Object.keys(baseline)) delete baseline[key]
        skipped.length = 0
        break
      }
      const hash = hashFile(join(repoRoot, relPath))
      if (hash === null) {
        skipped.push(relPath)
        continue
      }
      baseline[normalizeBaselinePath(relPath)] = hash
    }
  }

  checkpoint.worktreeBaseline = method === 'unavailable' ? {} : baseline
  checkpoint.worktreeBaselineRoot = repoRoot
  checkpoint.worktreeBaselineMethod = method
  checkpoint.worktreeBaselineCapturedAt = startedAt
  checkpoint.worktreeBaselineSkipped = [...skipped]
  checkpoint.worktreeBaselineDirtyPaths =
    method === 'git' ? (dirtyPaths ?? undefined) : undefined
}

/**
 * Lazy capture hook for the tool pipeline: captures the baseline exactly
 * once per session, on the first tool call that can reach the worktree —
 * a write-path tool OR a call the step-1 classifier marks mutating (the
 * first call being `sed -i …` must NOT defer capture to the reconciliation,
 * which needs this baseline to have anything to diff against). Terminal
 * tools (`end_turn`) never reach the worktree but classify non-mutating, so
 * they stay free. Pure-read sessions never pay the capture cost. No
 * checkpoint (SDK embedders) → no-op (CLI sessions always carry one).
 */
export function maybeCaptureWorktreeBaseline(
  checkpoint: GroundingCheckpoint | undefined,
  toolName: string,
  repoRoot: string,
  input?: Record<string, unknown>,
): void {
  if (!checkpoint) return
  if (checkpoint.worktreeBaselineCapturedAt != null) return
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
