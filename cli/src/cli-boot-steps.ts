import { yellow } from 'picocolors'

import { IS_SAVANT_FREE } from './utils/constants'
import {
  hasAnalyticsNoticeBeenShown,
  hasFreeOptionsNoticeBeenShown,
  loadAnalyticsEnabled,
  markAnalyticsNoticeShown,
  markFreeOptionsNoticeShown,
} from './utils/settings'
import { detectTerminalTheme } from './utils/terminal-color-detection'
import { setOscDetectedTheme } from './utils/theme-system'

/**
 * Pre-TUI boot steps (FID-2026-0819-005 Loop 133), moved verbatim from the
 * CLI entrypoint.
 */

/**
 * Run OSC theme detection BEFORE anything else. This MUST happen before
 * OpenTUI starts because OSC responses come through stdin, and OpenTUI also
 * listens to stdin. Running detection here ensures stdin is clean.
 */
export async function detectAndApplyOscTheme(): Promise<void> {
  if (process.stdin.isTTY && process.platform !== 'win32') {
    try {
      const oscTheme = await detectTerminalTheme()
      if (oscTheme) {
        setOscDetectedTheme(oscTheme)
      }
    } catch {
      // Silently ignore OSC detection failures
    }
  }
}

/**
 * FID-2026-0806-015: disclose the default-on analytics once, to brand-new
 * users, before the TUI starts. Printed to stderr so it never corrupts
 * piped stdout; the notice retires after the first show.
 */
export function discloseAnalyticsNoticeOnce(): void {
  if (loadAnalyticsEnabled() && !hasAnalyticsNoticeBeenShown()) {
    // eslint-disable-next-line no-console -- first-run disclosure banner
    console.error(
      yellow(
        'Note: anonymous usage analytics are enabled by default. Run /telemetry disable to turn them off.',
      ),
    )
    markAnalyticsNoticeShown()
  }
}

/**
 * FID-2026-1001-002: disclose the free-options discovery surface once, so
 * users ever learn `/provider free` exists — the discovery pipeline's
 * outputs are dev-side or on-demand (RED evidence), and the free-options
 * FID explicitly left proactive surfaces unselected. Non-free builds only:
 * `/provider` is not registered in SavantFree (FID-007 U1), and pointing
 * free users at it would produce "Command not found". Printed to stderr so
 * it never corrupts piped stdout; the notice retires after the first show.
 */
export function discloseFreeOptionsNoticeOnce(): void {
  if (IS_SAVANT_FREE || hasFreeOptionsNoticeBeenShown()) return
  // eslint-disable-next-line no-console -- first-run disclosure banner
  console.error(
    yellow(
      "Free AI lanes are available — run /provider free to see what you have (and haven't) wired.",
    ),
  )
  markFreeOptionsNoticeShown()
}
