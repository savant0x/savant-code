/**
 * Bounded worktree walk — the no-git fallback for Law 15 worktree
 * reconciliation (FID-2026-1001-003 step 2). Extracted from
 * `worktree-reconcile.ts` for the 300-line quality cap. The exclusion list
 * is the FID's stated ACCEPTED LIMIT: paths under these directories mutated
 * by the terminal are never detected — the rationale is that these trees are
 * build output / dependencies / vendored material, where a hash walk costs
 * more than the bypass risk it covers.
 */
import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export const EXCLUDED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'resources',
  'dist',
  'build',
  'target',
  'coverage',
  '.next',
  '.turbo',
])

/**
 * Enumerate candidate files (repo-relative, forward-slash) below `root`,
 * skipping excluded directories. Throws the budget sentinel when the shared
 * wall-clock budget is exhausted — the caller converts that into the
 * degraded/cannot-verify diagnostics (never a silent pass).
 */
export function walkCandidates(
  root: string,
  dir: string,
  startedAt: number,
  budgetMs: number,
): string[] {
  if (Date.now() - startedAt >= budgetMs) {
    throw new Error('reconcile-walk-budget')
  }
  const out: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (Date.now() - startedAt >= budgetMs) {
      throw new Error('reconcile-walk-budget')
    }
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue
      out.push(
        ...walkCandidates(root, join(dir, entry.name), startedAt, budgetMs),
      )
    } else if (entry.isFile()) {
      out.push(relative(root, join(dir, entry.name)).split(sep).join('/'))
    }
  }
  return out
}
