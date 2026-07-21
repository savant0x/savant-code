/**
 * FID-2026-0718-010 — run-finish lifecycle helpers.
 *
 * Centralizes the "stream is over, reset UI to idle" logic that was previously
 * scattered across three implementations (onNewUserMessage, runtime auto-idle,
 * finish handler). Single helper, many callers = audit-friendly.
 *
 *      ┌──────────────────────┐
 *      │  resetUiToIdle()      │  Single canonical reset path
 *      └──────────────────────┘
 *            ▲
 *            │ called from:
 *            │   - finally block in use-send-message.ts
 *            │   - abort handler in use-send-message.ts
 *            │   - slash-command bridges in command-registry.ts
 *            │   - handleFinish in sdk-event-handlers.ts (backstop)
 *            │   - stalled-reset timeout (this file)
 *
 *      ┌──────────────────────┐
 *      │  stalledResetWatcher │  Watchdog: 30s no chunks → reset + log
 *      └──────────────────────┘
 *
 *      ┌──────────────────────┐
 *      │  markChunkSeen()      │  O(1) timestamp write. Called from every
 *      │                       │  SDK chunk handler. Bumps the watermark.
 *      └──────────────────────┘
 */

import { logger } from './logger'
import { useChatStore } from '../state/chat-store'

/** Watermark constants — exposed for tests + audit (D1 = 2s, D2 = 30s). */
export const STALL_WATERMARK_MS = 30_000
export const RESET_ANTI_THRASH_MS = 100

export type ResetReason =
  | 'finish'
  | 'abort'
  | 'slash-command'
  | 'stalled'
  | 'backstop'
  | 'new-user-message'

/**
 * Single canonical reset path. Idempotent — safe to call from multiple
 * gates (finish chunk, abort, slash, stalled-detector) within a few ms.
 *
 * Guards (FID §3.2 Q15-Q19):
 *   - skip if `isRetrying` (false-positive protection on retry path)
 *   - skip if elapsed since `lastResetAt < RESET_ANTI_THRASH_MS`
 *   - skip if `isChainInProgress === true` (stalled-detector calls only;
 *     run-completion calls may run unconditionally)
 */
export function resetUiToIdle(reason: ResetReason, opts?: { force?: boolean }): void {
  const store = useChatStore.getState()

  // Same set of guards the action implements, but exposed as a util for
  // callers like the stalled detector whose semantic is "watchdog, not
  // user-driven" — they need to inspect chat-store pre-action.
  if (!opts?.force) {
    if (store.isRetrying) {
      logger.debug({ reason }, '[finish-logic] resetUiToIdle skipped (isRetrying)')
      return
    }
    if (Date.now() - store.lastResetAt < RESET_ANTI_THRASH_MS) {
      logger.debug(
        { reason, lastResetAt: store.lastResetAt },
        '[finish-logic] resetUiToIdle skipped (anti-thrash)',
      )
      return
    }
  }

  store.onStreamEnded(reason)
  logger.debug({ reason }, '[finish-logic] UI reset to idle')
}

/**
 * Set the `_lastChunkAtMs` watermark. Called from every SDK chunk handler
 * to bump the watchdog timestamp. O(1).
 *
 * Source: FID-2026-0718-010 §3.1 F3 + §3.2 Q19.
 */
export function markChunkSeen(source: string): void {
  useChatStore.setState({ _lastChunkAtMs: Date.now() })
  // Single-line log so the watchdog's source attribution is debuggable.
  // Cheap — Date.now() + setState hash-match.
  logger.debug({ source }, '[finish-logic] chunk-seen watermark updated')
}

/**
 * Watchdog timer object. One per session. Started by use-send-message's
 * heartbeat (or by the stalled-detector setup), cleared on stream end.
 *
 * Behavior: every STALL_CHECK_MS, ask chat-store "has it been
 * > STALL_WATERMARK_MS since the last chunk?" If yes AND no live run AND
 * fsmPhase !== 'idle', fire resetUiToIdle({reason:'stalled'}) + warn.
 */
export type StalledResetWatcher = {
  start: () => void
  stop: () => void
}

const STALL_CHECK_MS = 5_000 // Check every 5s (cheap poll)

export function createStalledResetWatcher(): StalledResetWatcher {
  let intervalId: ReturnType<typeof setInterval> | null = null

  const start = () => {
    if (intervalId) return // idempotent
    intervalId = setInterval(() => {
      const state = useChatStore.getState()
      const now = Date.now()
      const sinceLastChunk = now - state._lastChunkAtMs

      // Trigger only when:
      //   - no live run
      //   - not retrying (retry path will reset on its own)
      //   - 30s+ since last chunk
      //   - would actually change state (avoid log spam when already idle)
      if (
        !state.isChainInProgress &&
        !state.isRetrying &&
        sinceLastChunk > STALL_WATERMARK_MS &&
        state.fsmPhase !== 'idle'
      ) {
        logger.warn(
          {
            sinceLastChunk,
            fsmPhase: state.fsmPhase,
            activity: state.activity,
          },
          '[finish-logic] stream stalled; auto-resetting to idle',
        )
        resetUiToIdle('stalled')
      }
    }, STALL_CHECK_MS)
  }

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  return { start, stop }
}
