/**
 * Law 15 turn-end scan (FID-2026-1006-004). Extracted from
 * `worktree-reconcile.ts` for the 300-line quality cap; two jobs, both
 * cost-bounded, both previously scaling with repository size.
 *
 * 1. CANDIDATES. Git enumerates the changed set cheaply (`git status`), and the
 *    content hashes decide; when that leg fails the bounded walk still yields a
 *    candidate set. A failed status leg therefore no longer collapses the whole
 *    scan into one blanket advisory — the caller decides what an absent hash
 *    means (see `resolveCandidates`'s unknown rule).
 *
 * 2. DELETIONS. The pre-split reconcile leg was one `statSync` per baseline key
 *    (5,459 calls measured at 181 ms — 36% of the 500 ms turn-end budget it
 *    shares with the enumeration spawn and the candidate hashing). The
 *    replacement is bounded by CHANGES, and each term exists because it covers
 *    a class no other term can see:
 *
 *    - (i) a clean-at-capture tracked file removed out of band. `git status`
 *      emits it (`D` in either column, a rename source, a typechange-to-missing)
 *      and one existence probe answers it. Intersected with the baseline's
 *      coverage so paths the baseline never recorded are not probed.
 *    - (ii) an untracked-at-capture file removed out of band. Git emits NO
 *      status entry for a vanished untracked file, so this class is visible only
 *      through the content record: a candidate carrying a stored hash whose
 *      content is now gone. Supplied by the caller's candidate loop.
 *    - (iii) a path `advanceWorktreeBaseline` created after capture (a
 *      session-created file) removed out of band. It is visible neither to
 *      status (untracked then gone) nor as an inventory member (it was never in
 *      the frozen inventory), so the map keys outside the inventory are
 *      existence-probed — O(session writes), except on a legacy checkpoint where
 *      the map IS the inventory and this is the old per-key scan.
 *    - (iv) walk-sourced candidates only: the walk enumerates the live tree, so
 *      an inventory path the walk no longer sees is gone. A pure set difference —
 *      no per-key IO — restricted to paths the walk could have seen at all (a
 *      tracked path under an excluded directory is never walked, so its absence
 *      proves nothing).
 *
 * A deletion stays a distinct outcome: reported and removed from the durable
 * baseline, never merged into `dirtyFiles`, never blocking on its own. The
 * removal is the third-livelock guard — the membership sets are rebuilt from
 * durable state every turn, so a path left in place would re-fire forever.
 */
import { statSync } from 'node:fs'
import { join } from 'node:path'

import { normalizeBaselinePath } from './worktree-capture'
import { describeGitFailure, runGitStatusList } from './worktree-git'
import { EXCLUDED_DIR_NAMES, walkCandidates } from './worktree-walk'

export type CandidateSource = 'status' | 'walk'

export type CandidateResolution = {
  candidates: string[]
  source: CandidateSource
  /** Status paths; empty when the status leg did not run or did not answer. */
  statusPaths: string[]
  /** Walk-enumerated keys, when the candidate set came from the walk. */
  walkedKeys: Set<string> | null
  /** Set when no candidate set could be enumerated — the caller fails closed. */
  failureDiagnostic?: string
}

/**
 * Resolve the turn-end candidate set. `dirtyAtCapture` is the caller's seed of
 * paths that were dirty when the baseline was captured (they stay candidates
 * even after git reports them clean).
 */
export function resolveCandidates(params: {
  method: 'git' | 'walk'
  repoRoot: string
  startedAt: number
  budgetMs: number
  dirtyAtCapture: string[]
}): CandidateResolution {
  const { method, repoRoot, startedAt, budgetMs } = params

  const viaWalk = (diagnostic: string): CandidateResolution => {
    let walked: string[]
    try {
      walked = walkCandidates(repoRoot, repoRoot, startedAt, budgetMs)
    } catch {
      return {
        candidates: [],
        source: 'walk',
        statusPaths: [],
        walkedKeys: null,
        failureDiagnostic: diagnostic,
      }
    }
    return {
      candidates: walked,
      source: 'walk',
      statusPaths: [],
      walkedKeys: new Set(walked.map((p) => normalizeBaselinePath(p))),
    }
  }

  if (method !== 'git') {
    return viaWalk(
      'Law 15 worktree reconciliation degraded: the fallback walk ' +
        `exceeded its ${budgetMs}ms budget at turn end. Cannot verify ` +
        'out-of-band mutations — failing closed.',
    )
  }

  const status = runGitStatusList(repoRoot, budgetMs)
  if (status.paths === null) {
    // The failed leg is named WITH its evidence (elapsed / error code): the
    // pre-split message said only "git failed at turn end", which is
    // indistinguishable from a broken control when git answers in ~110 ms.
    return viaWalk(
      'Law 15 worktree reconciliation degraded: the git status leg failed ' +
        `(${describeGitFailure(status)}) and the fallback walk exceeded its ` +
        `${budgetMs}ms budget. Cannot verify out-of-band mutations — failing closed.`,
    )
  }

  return {
    candidates: [...new Set([...status.paths, ...params.dirtyAtCapture])],
    source: 'status',
    statusPaths: status.paths,
    walkedKeys: null,
  }
}

/**
 * Could the bounded walk have enumerated this path at all? The walk skips
 * excluded directories wholesale, so a path below one is invisible to it — and
 * therefore its absence from a walk is not evidence that it was deleted.
 */
function isWalkVisible(relPath: string): boolean {
  const segments = relPath.split('/')
  return !segments
    .slice(0, -1)
    .some((segment) => EXCLUDED_DIR_NAMES.has(segment))
}

/** Existence probe for the deletion terms (`isFile`, never a hash). */
function baselinePathExists(absPath: string): boolean {
  try {
    return statSync(absPath).isFile()
  } catch {
    return false
  }
}

/** Collect the deletion set from all four terms, deduped in term order. */
export function collectDeletions(params: {
  repoRoot: string
  baselineRoot: string
  baselineKeys: string[]
  capturedInventory: Set<string>
  coverage: Set<string>
  statusPaths: string[]
  walkedKeys: Set<string> | null
  candidateDeleted: string[]
  budgetExceeded: () => boolean
}): { deleted: string[]; stoppedForBudget: boolean } {
  const deleted: string[] = []
  const seen = new Set<string>()
  const mark = (key: string): void => {
    if (seen.has(key)) return
    seen.add(key)
    deleted.push(key)
  }

  // (ii) supplied by the candidate loop — the only net for a vanished
  // untracked-at-capture file.
  for (const key of params.candidateDeleted) mark(key)

  // (i) a status path inside the baseline's coverage that no longer resolves.
  for (const raw of params.statusPaths) {
    const key = normalizeBaselinePath(raw)
    if (!params.coverage.has(key)) continue
    if (baselinePathExists(join(params.repoRoot, raw))) continue
    mark(key)
  }

  // (iii) map keys outside the frozen inventory, existence-probed. Bounded by
  // changes for a split git capture; a legacy checkpoint lands on its full
  // inventory (exactly the pre-split behaviour) and keeps the budget guard.
  for (const key of params.baselineKeys) {
    if (params.capturedInventory.has(key)) continue
    if (params.budgetExceeded()) {
      return { deleted, stoppedForBudget: true }
    }
    if (!baselinePathExists(join(params.baselineRoot, key))) mark(key)
  }

  // (iv) walk-sourced: inventory paths the walk no longer sees.
  if (params.walkedKeys !== null) {
    for (const key of params.capturedInventory) {
      if (!isWalkVisible(key)) continue
      if (!params.walkedKeys.has(key)) mark(key)
    }
  }

  return { deleted, stoppedForBudget: false }
}

/**
 * Durably remove the flagged paths from BOTH halves of the baseline. The
 * membership sets are rebuilt from durable state every turn, so a path left in
 * the inventory would be re-reported forever (the livelock the pre-split
 * `delete baseline[key]` prevented). Returns the trimmed inventory.
 */
export function dropBaselineKeys(params: {
  baseline: Record<string, string>
  inventory: string[]
  keys: string[]
}): string[] {
  if (params.keys.length === 0) return params.inventory
  const drop = new Set(params.keys)
  for (const key of params.keys) delete params.baseline[key]
  return params.inventory.filter((key) => !drop.has(key))
}
