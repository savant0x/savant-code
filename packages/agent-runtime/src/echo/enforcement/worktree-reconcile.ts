/**
 * Law 15 worktree reconciliation — turn-end evaluation
 * (FID-2026-1001-003 step 2). Baseline capture/advance live in
 * `./worktree-capture`, the bounded walk in `./worktree-walk`.
 *
 * `EnforcementState` only knows files that passed through a write tool; one
 * `run_terminal_command` (`sed -i`, `>`, `git checkout`) mutates the tree
 * with no record for the Law 15 backstop to find. At turn end this module
 * reconciles the durable baseline against the live tree:
 *
 * - `changed = { p : baseline[p] !== currentHash(p) }` (or new files absent
 *   from the baseline); `unaccounted = changed − dirtyFiles` is MERGED into
 *   `dirtyFiles` and BLOCKS — reporting without blocking recreates the
 *   "notifies but does not compel" failure this FID exists to end.
 * - Candidates, not inventory (closure correction 2026-10-02): hashing the
 *   FULL inventory every turn fit the 610-file tree it was measured on but
 *   blew the 500ms budget on a 5,000+-file repo. Per the spec sentence
 *   "git enumerates candidate paths cheaply; content hashes decide", the
 *   git leg enumerates only the CHANGED set (`git status --porcelain`) and
 *   hashes those plus initially dirty paths, which may become Git-clean.
 *   Legacy captures without candidates use the full baseline. The walk keeps
 *   inventory semantics (it is already the degraded branch).
 * - Deletion is a distinct outcome — baseline paths that no longer resolve
 *   are dropped from the baseline, never flagged dirty (third-livelock
 *   guard).
 * - Budget: bounded at 500ms (operator-confirmed Q5-A). Degraded scans fail
 *   CLOSED with a diagnostic; git unavailable AND walk over budget at
 *   capture → explicit "cannot verify" on every later turn — never a silent
 *   pass. The method used is recorded (Law 8).
 */
import { statSync } from 'node:fs'
import { join } from 'node:path'

import { canonicalizePath } from '../path-canonicalization'
import {
  hashFile,
  normalizeBaselinePath,
  runGitStatusList,
} from './worktree-capture'
import { walkCandidates } from './worktree-walk'

import type { GroundingCheckpoint } from '@savant-code/common/types/session-state'

/** Turn-end reconciliation budget (operator-confirmed, Q5-A: 500ms). */
export const RECONCILE_BUDGET_MS = 500

export type ReconcileMethod = 'git' | 'walk' | 'unavailable'

export type ReconcileOutcome = {
  /** Unaccounted changed paths, canonicalized — merged into dirtyFiles. */
  changed: string[]
  /** Baseline paths deleted since capture (distinct outcome, not dirty). */
  deleted: string[]
  /** True when the scan could not complete inside the budget. */
  degraded: boolean
  /** True when neither git nor the walk could run (explicit, never silent). */
  unverifiable: boolean
  /** Which enumeration method ran (Law 8 — log the method). */
  method: ReconcileMethod
  /** Human-readable diagnostic for the turn-end report. */
  diagnostic?: string
}

/**
 * Reconcile at turn end. Merges unaccounted changed paths into `dirtyFiles`
 * (raw and canonical spellings) and returns the outcome; the caller blocks
 * per the FID's "merge and block" mandate.
 */
export function reconcileWorktree(params: {
  checkpoint: GroundingCheckpoint | undefined
  repoRoot: string
  dirtyFiles: Set<string>
}): ReconcileOutcome {
  const { repoRoot, dirtyFiles } = params
  const checkpoint = params.checkpoint
  const startedAt = Date.now()

  // SDK embedders run without a grounding checkpoint and outside the ECHO
  // harness contract — no reconciliation, no diagnostic (the harness gate
  // never armed; matches ensureCheckpoint()'s silent no-op elsewhere).
  if (!checkpoint) {
    return {
      changed: [],
      deleted: [],
      degraded: false,
      unverifiable: false,
      method: 'unavailable',
    }
  }

  const noVerify = (why: string): ReconcileOutcome => ({
    changed: [],
    deleted: [],
    degraded: false,
    unverifiable: true,
    method: 'unavailable',
    diagnostic: `Law 15 worktree reconciliation cannot verify: ${why} — out-of-band mutations are unverifiable this turn. Run the project verification commands explicitly.`,
  })

  const baselineRoot = checkpoint.worktreeBaselineRoot
  if (checkpoint.worktreeBaselineCapturedAt == null || !baselineRoot) {
    return noVerify('no baseline was captured this session')
  }
  if (
    checkpoint.worktreeBaselineMethod === 'unavailable' ||
    checkpoint.worktreeBaselineMethod === undefined
  ) {
    return noVerify(
      'baseline capture failed or could not enumerate/hash within its initialization budget',
    )
  }

  const method = checkpoint.worktreeBaselineMethod
  const baseline = checkpoint.worktreeBaseline ?? {}
  const skipped = new Set(checkpoint.worktreeBaselineSkipped ?? [])

  /*
   * Cost model, corrected at closure (2026-10-02): the first implementation
   * re-hashed the FULL inventory at turn end — inside the budget on the
   * 610-file tree it was measured on, ~6s on a 5,000+-file repo when cwd
   * is the repo root (a budget blow EVERY turn). The spec's own sentence
   * is the design: "git enumerates candidate paths cheaply; content hashes
   * decide." Enumerate the CHANGED set with `git status --porcelain`
   * (cheap) and hash only those candidates; the baseline supplies the
   * unchanged remainder (a file dirty at capture AND modified again is
   * still caught — its path is in the status set both times, pinned).
   * Deleted tracked files arrive via status and hash-null-skip below; the
   * baseline-deletion leg (fileExists over the baseline root) already
   * handled deletions without any inventory.
   */
  let candidates: string[] = []
  if (method === 'git') {
    const status = runGitStatusList(repoRoot)
    if (status === null) {
      return {
        changed: [],
        deleted: [],
        degraded: true,
        unverifiable: false,
        method,
        diagnostic:
          'Law 15 worktree reconciliation degraded: git failed at turn end ' +
          '(it worked at capture). Cannot verify out-of-band mutations — ' +
          'failing closed.',
      }
    }
    candidates = [
      ...new Set([
        ...status,
        ...(checkpoint.worktreeBaselineDirtyPaths ?? Object.keys(baseline)),
      ]),
    ]
  } else {
    try {
      candidates = walkCandidates(
        repoRoot,
        repoRoot,
        startedAt,
        RECONCILE_BUDGET_MS,
      )
    } catch {
      return {
        changed: [],
        deleted: [],
        degraded: true,
        unverifiable: false,
        method,
        diagnostic:
          'Law 15 worktree reconciliation degraded: the fallback walk ' +
          'exceeded its budget at turn end. Cannot verify out-of-band ' +
          'mutations — failing closed.',
      }
    }
  }

  const dirtyCanonical = new Set(
    [...dirtyFiles].map((p) => canonicalizePath(p)),
  )
  const changed: string[] = []
  const deleted: string[] = []

  const markUnaccounted = (absPath: string): void => {
    const canonical = canonicalizePath(absPath)
    if (!dirtyCanonical.has(canonical)) changed.push(canonical)
    dirtyFiles.add(absPath)
    dirtyFiles.add(canonical)
  }

  for (const relPath of candidates) {
    if (Date.now() - startedAt >= RECONCILE_BUDGET_MS) {
      return {
        changed,
        deleted,
        degraded: true,
        unverifiable: false,
        method,
        diagnostic:
          `Law 15 worktree reconciliation degraded: exceeded the ` +
          `${RECONCILE_BUDGET_MS}ms budget mid-scan — the remainder is ` +
          'treated as unaccounted (fail-closed).',
      }
    }
    const normalized = normalizeBaselinePath(relPath)
    if (skipped.has(normalized) || skipped.has(relPath)) continue
    const absPath = join(repoRoot, relPath)
    const currentHash = hashFile(absPath)
    if (currentHash === null) continue
    const baselineHash = baseline[normalized]
    if (baselineHash !== undefined) {
      if (
        baselineHash !== currentHash &&
        !dirtyCanonical.has(canonicalizePath(absPath))
      ) {
        markUnaccounted(absPath)
      }
    } else if (!dirtyCanonical.has(canonicalizePath(absPath))) {
      // New since capture (or previously skipped) — unaccounted change.
      markUnaccounted(absPath)
    }
  }

  // Deleted since capture: distinct outcome — drop from the baseline (the
  // baseline is mutated so a following turn does not re-report), never flag
  // dirty (third-livelock guard).
  for (const key of Object.keys(baseline)) {
    if (Date.now() - startedAt >= RECONCILE_BUDGET_MS) {
      return {
        changed,
        deleted,
        degraded: true,
        unverifiable: false,
        method,
        diagnostic:
          'Law 15 worktree reconciliation degraded: deletion scan exceeded the 500ms turn-end budget.',
      }
    }
    if (!fileExists(join(baselineRoot, key))) {
      deleted.push(key)
      delete baseline[key]
    }
  }

  const diagnostic =
    changed.length > 0 || deleted.length > 0
      ? `Law 15 worktree reconciliation (${method}): ${changed.length} unaccounted changed file(s), ${deleted.length} deleted file(s) since session start — mutations outside tracked write tools. Run the project verification commands explicitly.`
      : undefined

  return {
    changed,
    deleted,
    degraded: false,
    unverifiable: false,
    method,
    diagnostic,
  }
}

function fileExists(absPath: string): boolean {
  try {
    return statSync(absPath).isFile()
  } catch {
    return false
  }
}
