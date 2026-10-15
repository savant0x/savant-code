import {
  markSavantFreeSessionEnded,
  markSavantFreeSessionSuperseded,
  refreshSavantFreeSession,
} from '../../use-savant-free-session'

import type { getSavantFreeGateErrorKind } from '../../../utils/error-handling'
import type { BatchedMessageUpdater } from '../../../utils/message-updater'

/** FID-2026-0915-001 (W5): 429 detection on any error shape (throw or output). */
export function isRateLimited(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const status =
    (error as { statusCode?: unknown }).statusCode ??
    (error as { status?: unknown }).status
  return status === 429
}

/**
 * Surface + recover from a session gate rejection. The server rejected
 * the request because our session is no longer valid; update local state so
 * the UI reflects reality and we stop sending requests until we re-admit.
 */
export function handleSavantFreeGateError(
  kind: ReturnType<typeof getSavantFreeGateErrorKind>,
  updater: BatchedMessageUpdater,
  opts: {
    messageWasDropped?: boolean
  } = {},
) {
  switch (kind) {
    case 'session_expired':
    case 'waiting_room_required':
    case 'session_model_mismatch':
      // Our seat is gone mid-chat. Finalize the AI message so its streaming
      // indicator stops — otherwise `isComplete` stays false and the message
      // keeps rendering a blinking cursor forever, making the user think the
      // agent is still working even though the SessionEndedBanner is visible
      // and actionable. Also disposes the batched-updater flush interval.
      updater.markComplete()
      // Rejected before producing anything (the run-start guard missed
      // because only the server knew the slot was gone): the prompt won't be
      // processed and isn't re-queued, so say so instead of leaving it
      // looking sent. Runs that got partway keep the quieter banner-only UX.
      if (opts.messageWasDropped) {
        updater.setError(
          'Your free session ended before this message was processed. Send it again after starting a new session.',
        )
      }
      // Flip to `ended` instead of auto re-queuing: the Chat surface stays
      // mounted so any in-flight agent work can finish under the server-side
      // grace period, and the session-ended banner prompts the user to press
      // Enter when they're ready to rejoin.
      markSavantFreeSessionEnded()
      return
    case 'waiting_room_queued':
      // Legacy error code: sessions are admitted immediately now, so this is
      // only reachable in a transient race with a concurrent session request.
      updater.setError(
        'Your free session is still being set up. Try again in a moment.',
      )
      // Re-sync without resetting chat — this is a "we'll wait", not a
      // "let's start fresh".
      refreshSavantFreeSession().catch(() => {})
      return
    case 'session_superseded':
      updater.setError(
        'Another savant-free CLI took over this account. Close the other instance, then restart.',
      )
      // Terminal state: stop polling and flip UI to a "please restart" screen
      // so we don't silently fight the other instance for the seat.
      markSavantFreeSessionSuperseded()
      return
    default:
      return
  }
}
