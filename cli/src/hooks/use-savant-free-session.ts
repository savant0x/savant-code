import {
  FALLBACK_SAVANT_FREE_MODEL_ID,
  LIMITED_SAVANT_FREE_MODEL_ID,
} from '@savant-code/common/constants/savant-free-models'
import { getRateLimitsByModel } from '@savant-code/common/types/savant-free-session'
import { useEffect } from 'react'

import {
  getSelectedSavantFreeModel,
  useSavantFreeModelStore,
} from '../state/savant-free-model-store'
import { useSavantFreeSessionStore } from '../state/savant-free-session-store'
import { getAuthTokenDetails } from '../utils/auth'
import { IS_SAVANT_FREE } from '../utils/constants'
import { isDirectProviderMode } from '../utils/env'
import { logger } from '../utils/logger'
import {
  isSavantFreeInstanceOwnedByDeadLocalProcess,
  recordSavantFreeInstanceOwner,
} from '../utils/savant-free-instance-owner'
import { rememberReferral } from '../utils/savant-free-referral-cache'
import { runLandingRestart } from './use-savant-free-session/landing-restart'
import {
  callSession,
  nextDelayMs,
  playAdmissionSound,
  POLL_TIMINGS,
} from './use-savant-free-session/session-api'
import {
  getSavantFreeInstanceId,
  holdsLiveSavantFreeSlot,
  setPollController,
} from './use-savant-free-session/session-state'

import type { SavantFreeSession } from '../types/savant-free-session'

// Public imperative surface (re-exported so existing consumers are untouched):
export {
  endSavantFreeSessionBestEffort,
  getSavantFreeInstanceId,
  holdsLiveSavantFreeSlot,
  markSavantFreeSessionCountryBlocked,
  markSavantFreeSessionEnded,
  markSavantFreeSessionSuperseded,
  refreshSavantFreeLandingMetadata,
  refreshSavantFreeSession,
  resetChatStore,
  returnToSavantFreeLanding,
  startSavantFreeSession,
  takeOverSavantFreeSession,
} from './use-savant-free-session/session-state'
export { sessionFetchSignal } from './use-savant-free-session/session-api'

interface UseSavantFreeSessionResult {
  session: SavantFreeSession | null
  error: string | null
}

/**
 * Manages the savant-free session lifecycle:
 *   - GET on mount to probe state (no auto-join; the user picks a model in
 *     the landing screen, which calls startSavantFreeSession)
 *   - if the probe sees an existing seat, auto-takes-over when the prior
 *     local owner process is gone; otherwise asks before POSTing to rotate
 *     the instance id so any other CLI on the same account is superseded
 *   - polls GET while active to keep state fresh
 *   - re-POSTs on explicit refresh (chat gate rejected us, user switched
 *     models, user rejoined after ending)
 *   - DELETE on unmount so the slot frees up for the next user
 *   - plays a bell on admission to an active session
 */
export function useSavantFreeSession(): UseSavantFreeSessionResult {
  const session = useSavantFreeSessionStore((s) => s.session)
  const error = useSavantFreeSessionStore((s) => s.error)
  useEffect(() => {
    const { setSession, setError } = useSavantFreeSessionStore.getState()
    if (!IS_SAVANT_FREE || isDirectProviderMode()) {
      // Non-savant-free (SavantCode) builds never gate on a free session; leave the
      // store empty (app.tsx's session routing is all behind IS_SAVANT_FREE).
      setSession(null)
      return
    }
    const { token } = getAuthTokenDetails()
    if (!token) {
      logger.warn(
        {},
        '[savant-free-session] No auth token; skipping free-session admission',
      )
      setError('Not authenticated')
      return
    }
    let cancelled = false
    let abortController = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null
    let previousStatus: SavantFreeSession['status'] | null = null
    let restartGeneration = 0
    // Method for the NEXT tick. GET is read-only; POST claims/rotates a seat.
    // Startup is GET (probe before committing). After any POST completes we
    // flip back to GET. refresh() sets it to 'POST' for explicit join/rejoin;
    // the startup takeover branch does the same when the probe finds a seat.
    let nextMethod: 'GET' | 'POST' = 'GET'
    const apply = (next: SavantFreeSession) => {
      rememberReferral(next)
      if (next.status === 'active') {
        useSavantFreeModelStore.getState().setSelectedModel(next.model)
        recordSavantFreeInstanceOwner(next.instanceId)
      } else if (next.status === 'none' && next.accessTier === 'limited') {
        useSavantFreeModelStore
          .getState()
          .setSelectedModel(LIMITED_SAVANT_FREE_MODEL_ID)
      }
      setSession(next)
      setError(null)
      previousStatus = next.status
    }
    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
    const schedule = (ms: number) => {
      if (cancelled) return
      clearTimer()
      timer = setTimeout(tick, ms)
    }
    const tick = async () => {
      if (cancelled) return
      const method = nextMethod
      const instanceId = getSavantFreeInstanceId()
      const model = getSelectedSavantFreeModel()
      try {
        const next = await callSession(method, token, {
          signal: abortController.signal,
          instanceId,
          model,
        })
        if (cancelled) return
        // After any successful call, default back to GET polling. The
        // takeover and model_locked branches below override this when they
        // need another POST.
        nextMethod = 'GET'
        // Race recovery: user picked a different model on the landing screen at
        // the exact moment the server admitted them with the original model.
        // Silently revert the local selection and re-tick so the next call
        // (a GET) lands the actual active session. Users who really want to
        // switch can /end-session deliberately.
        if (next.status === 'model_locked') {
          useSavantFreeModelStore.getState().setSelectedModel(next.currentModel)
          schedule(0)
          return
        }
        if (next.status === 'model_unavailable') {
          // Server says the requested model isn't available right now. Flip
          // to the always-available fallback for this run. In-memory only —
          // `setSelectedModel` doesn't persist, so the user's saved preference
          // is preserved for their next launch.
          useSavantFreeModelStore
            .getState()
            .setSelectedModel(FALLBACK_SAVANT_FREE_MODEL_ID)
          // The unavailable response came from a POST attempt. Re-POST with
          // the fallback model; a GET would only redisplay the old ended row
          // and leave the restart banner stuck in its pending state.
          nextMethod = 'POST'
          schedule(0)
          return
        }
        // Startup takeover: the initial probe GET saw we already hold a seat
        // (from a prior CLI instance). Stop here and ask before POSTing to
        // rotate our instance id; otherwise opening a second savant-free would
        // immediately supersede the first one.
        // `previousStatus === null` fences this to the very first tick only.
        // Pin the selected model to whatever the server thinks we're on so
        // an explicit takeover preserves our queue position instead of
        // switching queues.
        if (
          method === 'GET' &&
          previousStatus === null &&
          next.status === 'active'
        ) {
          useSavantFreeModelStore.getState().setSelectedModel(next.model)
          // A fast restart after Ctrl+C can observe the old server row before
          // best-effort DELETE lands. If the row belongs to a dead local
          // process, silently do the same POST as the Take over button.
          if (isSavantFreeInstanceOwnedByDeadLocalProcess(next.instanceId)) {
            nextMethod = 'POST'
            schedule(0)
            return
          }
          apply({ status: 'takeover_prompt', model: next.model })
          return
        }
        // Bell on admission: the user committed to a model on the landing
        // screen (status 'none'), which POSTs and lands them straight on an
        // active session (admission is immediate).
        if (previousStatus === 'none' && next.status === 'active') {
          playAdmissionSound()
        }
        // active|ended → none means we've passed the server's hard cutoff.
        // Synthesize a no-instanceId ended state so the chat surface stays
        // mounted with the Enter-to-rejoin banner instead of looping back
        // through the landing screen. Carry forward whichever rate-limit
        // snapshot we have — preferring the fresh `none` snapshot, falling
        // back to whatever was on the prior active/ended row — so the
        // banner's "N of M used today" line stays populated.
        if (
          (previousStatus === 'active' || previousStatus === 'ended') &&
          next.status === 'none'
        ) {
          const current = useSavantFreeSessionStore.getState().session
          const rateLimitsByModel =
            next.rateLimitsByModel ?? getRateLimitsByModel(current)
          apply({
            status: 'ended',
            accessTier:
              next.accessTier ??
              (current && 'accessTier' in current
                ? current.accessTier
                : undefined),
            rateLimitsByModel,
          })
          return
        }
        apply(next)
        const delay = nextDelayMs(next)
        if (delay !== null) schedule(delay)
      } catch (err) {
        if (cancelled || abortController.signal.aborted) return
        const msg = err instanceof Error ? err.message : String(err)
        logger.warn({ error: msg }, '[savant-free-session] fetch failed')
        setError(msg)
        schedule(POLL_TIMINGS.error)
      }
    }
    // The controller binding lives in session-state.ts so the imperative
    // functions (restart / mark superseded / etc.) can talk to the live loop
    // without going through React.
    setPollController({
      restart: async (mode) => {
        const generation = ++restartGeneration
        clearTimer()
        // Abort any in-flight fetch so it can't race us and overwrite state.
        abortController.abort()
        abortController = new AbortController()
        // Reset previousStatus so the admission bell still fires after
        // a forced restart, and so the active|ended → none synthesis below
        // doesn't bounce a 'landing' restart straight back to 'ended'.
        previousStatus = null
        if (mode === 'landing') {
          nextMethod = 'GET'
          // Land on the picker immediately. We can't go through the normal
          // tick/apply path because a server-side row that hasn't been
          // swept yet would trip the startup-takeover branch into an
          // auto-POST — the exact silent-rejoin this mode exists to
          // prevent. But the picker still needs live quota snapshots, so
          // kick off a fire-and-forget GET and extract only picker metadata
          // from the response, ignoring whatever status it claims. Polling
          // resumes when the user commits to a model via
          // startSavantFreeSession.
          runLandingRestart({
            token,
            signal: abortController.signal,
            isStale: () => cancelled || generation !== restartGeneration,
            apply,
          })
          return
        }
        nextMethod = 'POST'
        await tick()
      },
      apply,
      abort: () => {
        clearTimer()
        abortController.abort()
      },
    })
    tick()
    return () => {
      cancelled = true
      abortController.abort()
      clearTimer()
      const current = useSavantFreeSessionStore.getState().session
      setPollController(null)
      // Fire-and-forget DELETE. Only release if we actually held a slot so
      // we don't generate spurious DELETEs (e.g. HMR before POST completes).
      if (holdsLiveSavantFreeSlot(current)) {
        callSession('DELETE', token).catch(() => {})
      }
      setSession(null)
      setError(null)
    }
  }, [])
  return { session, error }
}
