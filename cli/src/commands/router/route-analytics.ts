import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'

import { useSavantFreeSessionStore } from '../../state/savant-free-session-store'
import { trackEvent } from '../../utils/analytics'
import { IS_SAVANT_FREE } from '../../utils/constants'
import { isSlashCommand } from '../router-utils'

import type { AgentMode } from '../../utils/constants'
import type { InputMode } from '../../utils/input-modes'

interface TrackUserInputParams {
  trimmed: string
  agentMode: AgentMode
  inputMode: InputMode
  pendingImagesCount: number
  pendingTextAttachmentsCount: number
}

/**
 * Emits the user-input analytics events for a routed prompt: the un-sampled
 * USER_INPUT_COMPLETE signal plus the savant-free DAU MESSAGE_SENT event.
 * Extracted from route-user-prompt.ts.
 */
export function trackUserInputAnalytics({
  trimmed,
  agentMode,
  inputMode,
  pendingImagesCount,
  pendingTextAttachmentsCount,
}: TrackUserInputParams): void {
  // Count @ mentions (simple pattern match - more accurate than nothing)
  const mentionMatches = trimmed.match(/@\S+/g) || []
  trackEvent(AnalyticsEvent.USER_INPUT_COMPLETE, {
    inputLength: trimmed.length,
    mode: agentMode,
    inputMode,
    hasImages: pendingImagesCount > 0,
    imageCount: pendingImagesCount,
    hasTextAttachments: pendingTextAttachmentsCount > 0,
    textAttachmentCount: pendingTextAttachmentsCount,
    isSlashCommand: isSlashCommand(trimmed),
    isBashCommand: trimmed.startsWith('!'),
    hasMentions: mentionMatches.length > 0,
    mentionCount: mentionMatches.length,
  })

  // DAU signal: one un-sampled event per user-submitted prompt. The CLI's
  // distinct id resolves to the canonical savant-code user id (anonymous id is
  // aliased to the real user id on login), matching the web and chat surfaces
  // so combined DAU is a single unique-users query. SavantFree-only: savant-code
  // CLI usage is intentionally excluded.
  if (IS_SAVANT_FREE) {
    const savantFreeSession = useSavantFreeSessionStore.getState().session
    const accessTier: string =
      savantFreeSession &&
      typeof (savantFreeSession as { accessTier?: string }).accessTier ===
        'string'
        ? (savantFreeSession as { accessTier: string }).accessTier
        : 'unknown'

    trackEvent(AnalyticsEvent.MESSAGE_SENT, {
      surface: 'cli',
      accessTier,
      mode: agentMode,
      inputMode,
      inputLength: trimmed.length,
      isSlashCommand: isSlashCommand(trimmed),
      isBashCommand: trimmed.startsWith('!'),
      hasImages: pendingImagesCount > 0,
    })
  }
}
