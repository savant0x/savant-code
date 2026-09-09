import { CHATGPT_OAUTH_ENABLED } from '@savant-code/common/constants/chatgpt-oauth'
import {
  getChatGptOAuthCredentials,
  getValidChatGptOAuthCredentials,
  probeRipgrepAvailability,
} from '@savant-code/sdk'
import { enableMapSet } from 'immer'

import { initializeThemeStore } from '../hooks/use-theme'
import { setProjectRoot } from '../project-files'
import { initializeDirenv } from './init-direnv'
import { bootPresence } from '../state/presence'
import { initAnalytics } from '../utils/analytics'
import { getFingerprintId } from '../utils/fingerprint'
import { initTimestampFormatter } from '../utils/helpers'
import { logger } from '../utils/logger'
import {
  SAVANT_DISCORD_CLIENT_ID,
  loadAnalyticsEnabled,
  loadPresenceEnabled,
} from '../utils/settings'
import { enableManualThemeRefresh } from '../utils/theme-system'

export async function initializeApp(params: { cwd?: string }): Promise<void> {
  if (params.cwd) {
    process.chdir(params.cwd)
  }
  const baseCwd = process.cwd()
  setProjectRoot(baseCwd)

  // Initialize analytics before direnv, because direnv uses the logger
  // which calls trackEvent — analytics must be ready first.
  try {
    initAnalytics(loadAnalyticsEnabled())
  } catch (error) {
    logger.debug('Failed to initialize analytics:', error)
  }

  // Initialize direnv environment before anything else
  initializeDirenv()

  enableMapSet()
  initializeThemeStore()
  enableManualThemeRefresh()
  initTimestampFormatter()

  // FID-2026-0907-002 (Step 1): probe ripgrep once at boot so a missing
  // binary surfaces loudly here — with remediation — instead of as a
  // mid-task search failure. Warn-only: the resolver's fail-closed
  // behavior at call time is unchanged, and a probe problem must never
  // break boot.
  try {
    const rgProbe = probeRipgrepAvailability()
    if (!rgProbe.ok) {
      logger.warn(`Ripgrep unavailable: ${rgProbe.error}`)
    }
  } catch (error) {
    logger.debug('Ripgrep availability probe failed:', error)
  }

  // Compute the hardware-based fingerprint in the background so it's ready
  // by the time the user finishes reading the login prompt.
  void getFingerprintId()

  // FID-2026-0818-009: boot Discord Rich Presence (non-blocking, silent,
  // dormant-polling when Discord is absent; client id is hardcoded).
  bootPresence(loadPresenceEnabled(), SAVANT_DISCORD_CLIENT_ID)

  // Refresh ChatGPT OAuth credentials in the background if they exist
  if (CHATGPT_OAUTH_ENABLED) {
    const chatGptCredentials = getChatGptOAuthCredentials()
    if (chatGptCredentials) {
      getValidChatGptOAuthCredentials().catch(() => {
        // Best-effort background refresh.
      })
    }
  }
}
