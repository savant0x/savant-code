
import { flushAnalytics } from './analytics'
import { stopEngagementTracking } from './engagement'
import { withTimeout } from './terminal-color-detection'
import { endSavantFreeSessionBestEffort } from '../hooks/use-savant-free-session'

/** Cap on exit cleanup so a slow network doesn't block process exit. */
const EXIT_CLEANUP_TIMEOUT_MS = 1_000

/**
 * Flush analytics + release the savant-free seat (best-effort), then exit 0.
 * Shared by every savant-free-specific screen's Ctrl+C / X handler so they all
 * run the same cleanup.
 */
export async function exitSavantFreeCleanly(): Promise<never> {
  // Stop the heartbeat first so no engaged-minute fires mid-teardown, then
  // flush whatever's already queued.
  stopEngagementTracking()
  await withTimeout(
    Promise.allSettled([flushAnalytics(), endSavantFreeSessionBestEffort()]),
    EXIT_CLEANUP_TIMEOUT_MS,
    undefined,
  )
  process.exit(0)
}
