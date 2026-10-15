import { getReferralInfo } from '@savant-code/common/types/savant-free-session'

import { callSession } from './session-api'
import { toLandingSession } from './session-state'
import { useSavantFreeSessionStore } from '../../state/savant-free-session-store'

import type { SavantFreeSession } from '../../types/savant-free-session'

interface LandingRestartContext {
  /** Auth token for the fire-and-forget metadata GET. */
  token: string
  /** The poll loop's current abort signal (restart/unmount). */
  signal: AbortSignal
  /** True once the poll-loop generation or cancellation has moved on. */
  isStale: () => boolean
  /** Store writer from the poll loop (`apply`). */
  apply: (next: SavantFreeSession) => void
}

/**
 * Landing-mode restart body: drop to the model picker immediately, then
 * refresh the picker's metadata with a fire-and-forget GET. The caller has
 * already halted the poll loop and set the next method to GET — a
 * server-side row that hasn't been swept yet would otherwise trip the
 * startup-takeover branch into an auto-POST, the exact silent-rejoin this
 * mode exists to prevent. Polling resumes when the user commits to a model
 * via `startSavantFreeSession`.
 */
export function runLandingRestart(ctx: LandingRestartContext): void {
  const landingSession = toLandingSession(
    useSavantFreeSessionStore.getState().session,
  )
  ctx.apply(landingSession)
  callSession('GET', ctx.token, { signal: ctx.signal })
    .then((response) => {
      if (ctx.isStale() || ctx.signal.aborted) {
        return
      }
      if (response.status === 'none') {
        ctx.apply({
          status: 'none',
          accessTier: response.accessTier ?? landingSession.accessTier,
          rateLimitsByModel:
            response.rateLimitsByModel ?? landingSession.rateLimitsByModel,
          // Carry the referral block so the "change model" picker shows
          // the GLM banner too (the server only attaches it to `none`).
          referral: getReferralInfo(response) ?? landingSession.referral,
          countryCode: response.countryCode ?? landingSession.countryCode,
          countryBlockReason:
            response.countryBlockReason ?? landingSession.countryBlockReason,
          ipPrivacySignals:
            response.ipPrivacySignals ?? landingSession.ipPrivacySignals,
        })
      }
    })
    .catch(() => {
      // Silent — blank hints are acceptable if the fetch fails.
    })
}
