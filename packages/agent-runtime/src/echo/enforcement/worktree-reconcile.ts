/**
 * Law 15 worktree reconciliation — turn-end evaluation (FID-2026-1001-003
 * step 2; split baseline and change-bounded deletion source
 * FID-2026-1006-004). Baseline capture/advance live in `./worktree-capture`,
 * the git primitives in `./worktree-git`, the candidate resolution and
 * deletion terms in `./worktree-scan`, the bounded walk in `./worktree-walk`.
 *
 * `EnforcementState` only knows files that passed through a write tool; one
 * `run_terminal_command` (`sed -i`, `>`, `git checkout`) mutates the tree
 * with no record for the Law 15 backstop to find. At turn end this module
 * reconciles the durable baseline against the live tree:
 *
 * - `changed = { p : baseline[p] !== currentHash(p) }` (or candidates the
 *   change enumeration says are new); `unaccounted = changed − dirtyFiles` is
 *   MERGED into `dirtyFiles` and BLOCKS — reporting without blocking
 *   recreates the "notifies but does not compel" failure this FID exists to
 *   end.
 * - Candidates, not inventory (closure correction 2026-10-02): hashing the
 *   FULL inventory every turn fit the 610-file tree it was measured on but
 *   blew the 500ms budget on a 5,000+-file repo. Per the spec sentence
 *   "git enumerates candidate paths cheaply; content hashes decide", the git
 *   leg enumerates only the CHANGED set (`git status --porcelain`) and hashes
 *   those plus initially dirty paths, which may become Git-clean. Legacy
 *   captures without candidates use the full baseline map. The walk keeps
 *   inventory semantics (it is already the degraded branch).
 * - "Absent from the content record" means UNACCOUNTED only for a
 *   change-enumerated candidate. Since the split, absence means "was clean at
 *   capture", which is not evidence of change — so a walk-sourced candidate
 *   over a git-captured map with no stored hash is UNKNOWN (counted as
 *   unexamined, never flagged). Without that scoping, a failed status leg
 *   would fire once per clean file in the repository.
 * - Deletion is a distinct outcome — see `./worktree-scan` for the four
 *   bounded terms that replaced the per-key `statSync` scan. Flagged paths are
 *   dropped from the baseline (third-livelock guard), never flagged dirty.
 * - Budget: bounded at 500ms (operator-confirmed Q5-A), injectable so the
 *   degrade-vs-detect pins are deterministic instead of racing a clock.
 *   Degraded scans fail CLOSED with a diagnostic that names the leg and
 *   carries its evidence; git unavailable AND walk over budget at capture →
 *   explicit "cannot verify" on every later turn — never a silent pass. The
 *   method used is recorded (Law 8).
 */
import { join } from 'node:path'

import { canonicalizePath } from '../path-canonicalization'
import { hashFile, normalizeBaselinePath } from './worktree-capture'
import { RECONCILE_BUDGET_MS } from './worktree-git'
import {
  collectDeletions,
  dropBaselineKeys,
  resolveCandidates,
} from './worktree-scan'

import type { GroundingCheckpoint } from '@savant-code/common/types/session-state'

export { RECONCILE_BUDGET_MS }

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
  /** Walk-sourced candidates a git-captured map could not decide (step 5). */
  unexamined?: number
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
  budgetMs?: number
}): ReconcileOutcome {
  const { repoRoot, dirtyFiles } = params
  const checkpoint = params.checkpoint
  const budgetMs = params.budgetMs ?? RECONCILE_BUDGET_MS
  const startedAt = Date.now()
  const withinBudget = (): boolean => Date.now() - startedAt < budgetMs

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
    // FID-2026-1006-004 step 2: the refusal names its leg (capture records it)
    // instead of one catch-all sentence no reader can act on.
    const leg = checkpoint.worktreeBaselineFailure ?? 'unrecorded leg'
    return noVerify(
      `baseline capture failed (${leg}) or could not enumerate/hash within its initialization budget`,
    )
  }

  const method = checkpoint.worktreeBaselineMethod
  const baseline = checkpoint.worktreeBaseline ?? {}
  const skipped = new Set(checkpoint.worktreeBaselineSkipped ?? [])
  let inventory = checkpoint.worktreeBaselinePaths ?? []
  const capturedInventory = new Set(inventory)
  // Membership only — never iterated with per-key probes (step 3). The union
  // subsumes a legacy checkpoint, whose map still covers its own inventory.
  const coverage = new Set([...capturedInventory, ...Object.keys(baseline)])

  // Candidate resolution (./worktree-scan): git's changed set, falling back to
  // the bounded walk. The dirty-at-capture seed keeps HEAD's exact expression
  // (step 3) — a git capture always defines it, and an empty `[]` is defined,
  // so `??` does not fall through to the map keys.
  const resolution = resolveCandidates({
    method,
    repoRoot,
    startedAt,
    budgetMs,
    dirtyAtCapture:
      checkpoint.worktreeBaselineDirtyPaths ?? Object.keys(baseline),
  })
  if (resolution.failureDiagnostic) {
    return {
      changed: [],
      deleted: [],
      degraded: true,
      unverifiable: false,
      method,
      diagnostic: resolution.failureDiagnostic,
    }
  }
  const { candidates, statusPaths, walkedKeys } = resolution

  const dirtyCanonical = new Set(
    [...dirtyFiles].map((p) => canonicalizePath(p)),
  )
  const changed: string[] = []
  const candidateDeleted: string[] = []
  /**
   * Walk-sourced absence over a git-captured map is UNKNOWN, not evidence: the
   * map holds only the initially-dirty set, so "absent" simply means "clean at
   * capture". Counted and reported, never flagged (step 5).
   */
  const absenceIsChange = resolution.source === 'status' || method === 'walk'
  let unexamined = 0

  const markUnaccounted = (absPath: string): void => {
    const canonical = canonicalizePath(absPath)
    if (!dirtyCanonical.has(canonical)) changed.push(canonical)
    dirtyFiles.add(absPath)
    dirtyFiles.add(canonical)
  }

  for (const relPath of candidates) {
    if (!withinBudget()) {
      return {
        changed,
        deleted: [],
        degraded: true,
        unverifiable: false,
        method,
        diagnostic:
          'Law 15 worktree reconciliation degraded: exceeded the ' +
          `${budgetMs}ms budget mid-scan — the remainder is ` +
          'treated as unaccounted (fail-closed).',
      }
    }
    const normalized = normalizeBaselinePath(relPath)
    if (skipped.has(normalized) || skipped.has(relPath)) continue
    const absPath = join(repoRoot, relPath)
    const currentHash = hashFile(absPath)
    const baselineHash = baseline[normalized]
    if (baselineHash !== undefined) {
      if (currentHash === null) {
        // Deletion term (ii): a stored-hash path whose content is gone is the
        // only net for a vanished untracked-at-capture file.
        candidateDeleted.push(normalized)
        continue
      }
      if (
        baselineHash !== currentHash &&
        !dirtyCanonical.has(canonicalizePath(absPath))
      ) {
        markUnaccounted(absPath)
      }
      continue
    }
    // No stored hash. A vanished path has nothing to compare (as before);
    // otherwise only a change-enumerated candidate means "new".
    if (currentHash === null) continue
    if (!absenceIsChange) {
      unexamined += 1
      continue
    }
    if (!dirtyCanonical.has(canonicalizePath(absPath))) {
      markUnaccounted(absPath)
    }
  }

  const terms = collectDeletions({
    repoRoot,
    baselineRoot,
    baselineKeys: Object.keys(baseline),
    capturedInventory,
    coverage,
    statusPaths,
    walkedKeys,
    candidateDeleted,
    budgetExceeded: () => !withinBudget(),
  })
  if (terms.stoppedForBudget) {
    return {
      changed,
      deleted: [],
      degraded: true,
      unverifiable: false,
      method,
      diagnostic:
        'Law 15 worktree reconciliation degraded: the deletion scan ' +
        `exceeded the ${budgetMs}ms turn-end budget.`,
    }
  }

  inventory = dropBaselineKeys({
    baseline,
    inventory,
    keys: terms.deleted,
  })
  if (checkpoint.worktreeBaselinePaths !== undefined) {
    checkpoint.worktreeBaselinePaths = inventory
  }
  const { deleted } = terms
  const counts =
    `${changed.length} unaccounted changed file(s), ` +
    `${deleted.length} deleted file(s) since session start`

  if (unexamined > 0) {
    return {
      changed,
      deleted,
      degraded: true,
      unverifiable: false,
      method,
      unexamined,
      diagnostic:
        'Law 15 worktree reconciliation degraded: the git status leg failed ' +
        `at turn end, so ${unexamined} walked path(s) could not be compared ` +
        `against the baseline (unexamined). ${counts} — mutations outside ` +
        'tracked write tools. Run the project verification commands explicitly.',
    }
  }

  return {
    changed,
    deleted,
    degraded: false,
    unverifiable: false,
    method,
    diagnostic:
      changed.length > 0 || deleted.length > 0
        ? `Law 15 worktree reconciliation (${method}): ${counts} — mutations outside tracked write tools. Run the project verification commands explicitly.`
        : undefined,
  }
}
