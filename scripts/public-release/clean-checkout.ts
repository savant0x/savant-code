// FID-2026-0909-001 — self-healing clean-checkout directory lifecycle.
//
// The v0.0.30 cut left an orphaned Temp checkout behind on a failed gate
// run: the `finally`'s `git worktree remove --force` result was discarded,
// so a Windows node_modules lock turned transient cleanup into a permanent
// silent block (`fatal: ... already exists` on every later attempt), and
// no git command can clear an unregistered orphan directory.
//
// Contract (best-effort, never fail-closed — FID Missed Question 2):
//   - the pre-create guard clears debris from a PREVIOUS failed run before
//     `git worktree add`, so the next run self-heals;
//   - cleanup captures the git removal outcome and verifies absence on the
//     filesystem; a surviving directory falls back to a filesystem removal;
//   - every failure surfaces as a structured warning naming the path and
//     the manual remediation. Cleanup failures NEVER abort the run.
//
// All command + filesystem surfaces are injected (repo DI convention —
// the provenance suite drives this module with memory adapters only).

import { existsSync, rmSync } from 'node:fs'

import type { CommandRunner } from './provenance'

/** Production filesystem seam: node:fs with bounded retries for the
 * Windows lock classes (EBUSY/EPERM) that caused the v0.0.30 incident. */
export const defaultCheckoutFilesystem: CheckoutFilesystem = {
  exists: (targetPath) => existsSync(targetPath),
  remove: (targetPath) => {
    try {
      rmSync(targetPath, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      })
      return true
    } catch {
      return false
    }
  },
}

/** The warning sink: stderr, prefixed, never thrown. */
export function emitLifecycleWarning(message: string): void {
  console.error(`[clean-checkout] ${message}`)
}

/**
 * The filesystem seam the lifecycle needs. Production wires `existsSync` +
 * `rmSync`; tests wire memory adapters. `remove` reports success so a
 * locked directory (the incident class) is detectable.
 */
export interface CheckoutFilesystem {
  exists: (path: string) => boolean
  remove: (path: string) => boolean
}

/** The lifecycle's outcome: cleanup ran best-effort; these are the warnings. */
export interface CleanupOutcome {
  warnings: string[]
}

function manualRemediation(checkoutPath: string): string {
  return `Manual remediation: remove the directory (rm -rf "${checkoutPath}") and re-run.`
}

function removalWarning(checkoutPath: string, detail: string): string {
  return (
    `Clean-checkout directory survived cleanup: ${checkoutPath} (${detail}). ` +
    manualRemediation(checkoutPath)
  )
}

/**
 * Pre-create guard: if a checkout directory already exists at the versioned
 * path (debris from a previous failed run), clear it BEFORE the worktree is
 * created. Sequence: `git worktree remove --force` (unregisters cleanly
 * when the debris IS a registered worktree; harmless when it is not), then
 * a filesystem removal for whatever survives. Best-effort: failures warn,
 * never throw — the directory is recoverable debris, and a fail-closed
 * guard would reintroduce the very block this module removes.
 */
export function ensureCheckoutDirectoryAbsent(
  checkoutPath: string,
  root: string,
  runner: CommandRunner,
  fsAdapter: CheckoutFilesystem,
): CleanupOutcome {
  const warnings: string[] = []
  if (!fsAdapter.exists(checkoutPath)) return { warnings }

  const remove = runner(
    'git',
    ['worktree', 'remove', '--force', checkoutPath],
    root,
  )
  const detail =
    (remove.status ?? 1) !== 0
      ? remove.stderr.trim()
      : 'git removal reported success'

  if (fsAdapter.exists(checkoutPath)) {
    if (!fsAdapter.remove(checkoutPath)) {
      warnings.push(removalWarning(checkoutPath, detail))
    }
  }
  return { warnings }
}

/**
 * Finally-path cleanup: unregister the worktree, then verify absence on the
 * filesystem and fall back to a filesystem removal for survivors (the
 * incident class: git reports success while locked files remain on disk).
 * The git removal is always issued — it is the registration owner even in
 * degenerate states. Warnings carry the failing layer's own detail.
 */
export function cleanupCheckoutDirectory(
  checkoutPath: string,
  root: string,
  runner: CommandRunner,
  fsAdapter: CheckoutFilesystem,
): CleanupOutcome {
  const warnings: string[] = []
  const remove = runner(
    'git',
    ['worktree', 'remove', '--force', checkoutPath],
    root,
  )
  const detail =
    (remove.status ?? 1) !== 0
      ? remove.stderr.trim() || `exit ${remove.status}`
      : 'git removal reported success'

  if (fsAdapter.exists(checkoutPath) && !fsAdapter.remove(checkoutPath)) {
    warnings.push(removalWarning(checkoutPath, detail))
  }
  return { warnings }
}
