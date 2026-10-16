import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'

import { trackEvent } from '../../utils/analytics'
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
}
