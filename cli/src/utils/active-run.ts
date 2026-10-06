// Registry for the in-flight agent run's abort hook. Chat switches (/new,
// resuming from /history) must stop the active run: an orphaned run would keep
// streaming invisibly and keep persisting checkpoints for a chat the user has
// left. ownerId ties the registration to a specific run so a stale run
// settling late can't clear a newer run's aborter.

let activeRun: { ownerId: string; abort: () => void } | null = null

export function setActiveRunAborter(ownerId: string, abort: () => void): void {
  activeRun = { ownerId, abort }
}

export function clearActiveRunAborter(ownerId: string): void {
  if (activeRun?.ownerId === ownerId) {
    activeRun = null
  }
}

/**
 * Abort the in-flight agent run, if any. Safe to call when idle.
 *
 * FID-2026-1006-003 WP6: reports whether a run was actually aborted, so a
 * chat switch can tell "this conversation was mid-turn and is being
 * abandoned" apart from "nothing was running" and leave a branch summary
 * behind in the first case (see utils/branch-summary.ts). Callers that only
 * want the abort may ignore the result.
 */
export function abortActiveRun(): boolean {
  if (!activeRun) return false
  activeRun.abort()
  return true
}
