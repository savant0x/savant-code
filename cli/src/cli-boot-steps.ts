import { yellow } from 'picocolors'

import {
  hasAnalyticsNoticeBeenShown,
  loadAnalyticsEnabled,
  markAnalyticsNoticeShown,
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
