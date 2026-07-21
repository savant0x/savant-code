import {
  FALLBACK_SAVANT_FREE_MODEL_ID,
  LIMITED_SAVANT_FREE_MODEL_ID,
  resolveSavantFreeModelForAccessTier,
} from '@savant-code/common/constants/savant-free-models'
import { env } from '@savant-code/common/env'
import {
  getRateLimitsByModel,
  getReferralInfo,
} from '@savant-code/common/types/savant-free-session'
import { useEffect } from 'react'

import {
  getSelectedSavantFreeModel,
  useSavantFreeModelStore,
} from '../state/savant-free-model-store'
import { useSavantFreeSessionStore } from '../state/savant-free-session-store'
import { getAuthTokenDetails } from '../utils/auth'
import { IS_SAVANT_FREE } from '../utils/constants'
import { logger } from '../utils/logger'
import {
  isSavantFreeInstanceOwnedByDeadLocalProcess,
  recordSavantFreeInstanceOwner,
} from '../utils/savant-free-instance-owner'
import {
  getCachedReferral,
  rememberReferral,
} from '../utils/savant-free-referral-cache'

import type { SavantFreeSession } from '../types/savant-free-session'
import type {
  SavantFreeSessionState,
  SavantFreeBlockReason,
  SavantFreeIpPrivacySignal,
} from '@savant-code/common/types/savant-free-session'

const POLL_INTERVAL_ACTIVE_MS = 30_000
const POLL_INTERVAL_ERROR_MS = 10_000

/** Cap on any single session API call. Without it the only abort is the
 *  poll-loop restart controller, so a hung request (overloaded server, dead
 *  LB connection) pins the landing screen's "Starting…" spinner until Bun's
 *  ~300s idle fetch timeout. On timeout the tick loop's catch sees a
 *  non-restart abort, logs, and reschedules on POLL_INTERVAL_ERROR_MS. */
const SESSION_FETCH_TIMEOUT_MS = 20_000

/** Combine the caller's abort signal (poll-loop restart / unmount) with the
 *  per-request timeout. Exported for tests. */
export function sessionFetchSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number = SESSION_FETCH_TIMEOUT_MS,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/** Header sent on GET so the server can detect when another CLI on the same
 *  account has rotated the id and respond with `{ status: 'superseded' }`. */
const SAVANT_FREE_INSTANCE_HEADER = 'x-savant-free-instance-id'

/** Header sent on POST telling the server which model to use. */
const SAVANT_FREE_MODEL_HEADER = 'x-savant-free-model'

/** Play the terminal bell so users get an audible notification on admission. */
const playAdmissionSound = () => {
  try {
    process.stdout.write('\x07')
  } catch {
    // Silent fallback — some terminals/pipes disallow writing to stdout.
  }
}

const sessionEndpoint = (): string => {
  const base = (
    env.NEXT_PUBLIC_SAVANT_FREE_APP_URL || 'https://savant-code.com'
  ).replace(/\/$/, '')
  return `${base}/api/v1/savant-free/session`
}

async function callSession(
  method: 'POST' | 'GET' | 'DELETE',
  token: string,
  opts: { instanceId?: string; model?: string; signal?: AbortSignal } = {},
): Promise<SavantFreeSession> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (method === 'GET' && opts.instanceId) {
    headers[SAVANT_FREE_INSTANCE_HEADER] = opts.instanceId
  }
  if (method === 'POST' && opts.model) {
    headers[SAVANT_FREE_MODEL_HEADER] = opts.model
  }
  const resp = await fetch(sessionEndpoint(), {
    method,
    headers,
    signal: sessionFetchSignal(opts.signal),
  })
  // 404 = endpoint not deployed on this server (older web build). Treat as
  // "no session" so a newer CLI against an older server drops to the model
  // picker rather than stranding the user, rather than erroring out.
  if (resp.status === 404) {
    return { status: 'none' }
  }
  // 403 with a country_blocked or banned body is a terminal signal, not an
  // error — the server rejects non-allowlist countries and banned accounts up
  // front (see session _handlers.ts) so they don't wait through the queue only
  // to be rejected at chat time. The 403 status (rather than 200) is
  // deliberate: older CLIs that don't know these statuses treat them as a
  // generic error and back off on the 10s error-retry cadence instead of
  // tight-polling an unrecognized 200 body.
  if (resp.status === 403) {
    const body = (await resp
      .json()
      .catch(() => null)) as SavantFreeSession | null
    if (
      body &&
      (body.status === 'country_blocked' || body.status === 'banned')
    ) {
      return body
    }
  }
  // 409 from POST means the selected model cannot be joined right now, either
  // because an active session is locked to another model or because a
  // Surface model-switch conflicts and temporary model availability closures
  // as non-throw states.
  if (resp.status === 409 && method === 'POST') {
    const body = (await resp
      .json()
      .catch(() => null)) as SavantFreeSession | null
    if (
      body &&
      (body.status === 'model_locked' || body.status === 'model_unavailable')
    ) {
      return body
    }
  }
  // 429 from POST is the shared session-quota reject (too many SavantFree
  // sessions today). Terminal for the current poll — the CLI shows a screen
  // explaining the limit and when the user can try again. The 429 status
  // (rather than 200) keeps older CLIs in their error path so they back off
  // instead of tight-polling an unrecognized 200 body.
  if (resp.status === 429 && method === 'POST') {
    const body = (await resp
      .json()
      .catch(() => null)) as SavantFreeSession | null
    if (body && body.status === 'rate_limited') {
      return body
    }
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(
      `savant-free session ${method} failed: ${resp.status} ${text.slice(0, 200)}`,
    )
  }
  return (await resp.json()) as SavantFreeSession
}

/** Picks the poll delay after a successful tick. Returns null when the state
 *  is terminal (no further polling). */
function nextDelayMs(next: SavantFreeSession): number | null {
  switch (next.status) {
    case 'active':
      // Poll at the normal cadence, but ensure we land just after
      // `expires_at` so the transition shows up promptly instead of leaving
      // the countdown stuck at 0 for up to a full interval.
      return Math.max(
        1_000,
        Math.min(POLL_INTERVAL_ACTIVE_MS, next.remainingMs + 1_000),
      )
    case 'ended':
      // Inside the grace window we keep checking so the post-grace transition
      // (server returns `none`, we synthesize ended-no-instanceId) is prompt.
      return next.instanceId ? POLL_INTERVAL_ACTIVE_MS : null
    case 'none':
    case 'superseded':
    case 'takeover_prompt':
    case 'country_blocked':
    case 'banned':
    case 'model_locked':
    case 'rate_limited':
    case 'model_unavailable':
    case 'premium_slot_taken':
      return null
  }
}

// --- Poll-loop control surface ---------------------------------------------
//
// The hook below registers a controller object here on mount; module-level
// imperative functions (restart / mark superseded / mark ended / etc.) talk
// to it without going through React. Non-React callers (chat-completions
// gate, exit paths) hit those functions directly.

/** How the next tick should behave after a forced restart.
 *   - 'rejoin'  → POST: claim/rotate a seat (used after explicit end-and-rejoin
 *                 or when the chat gate kicks us back to the queue).
 *   - 'landing' → GET: drop to the model-picker (status 'none') so the user
 *                 reconfirms a model before rejoining. */
type RestartMode = 'rejoin' | 'landing'

interface PollController {
  /** Cancel the in-flight tick + timer and start a fresh one in `mode`. */
  restart: (mode: RestartMode) => Promise<void>
  apply: (next: SavantFreeSession) => void
  abort: () => void
}

let controller: PollController | null = null

/** Read the current instance id for outgoing chat requests. Defined via
 *  `holdsLiveSavantFreeSlot` so the two can't drift: an id exists exactly while
 *  we hold a live slot (active, or `ended` inside the server-side grace
 *  window where the row stays alive until `expires_at + grace`). */
export function getSavantFreeInstanceId(): string | undefined {
  const current = useSavantFreeSessionStore.getState().session
  if (!current || !holdsLiveSavantFreeSlot(current)) return undefined
  return 'instanceId' in current ? current.instanceId : undefined
}

/** True when the session represents a server-side slot the caller is
 *  holding (active, or in the post-expiry grace window with a live
 *  instance id). Chat requests are only admissible in these states — once
 *  the slot is gone, `getSavantFreeInstanceId` returns undefined and the
 *  server rejects the request — so the message queue gates on this before
 *  firing queued work. Same predicate gates DELETE on exit: outside these
 *  states there is no server row to release. */
export function holdsLiveSavantFreeSlot(
  current: SavantFreeSession | null,
): boolean {
  if (!current) return false
  return (
    current.status === 'active' ||
    (current.status === 'ended' && Boolean(current.instanceId))
  )
}

function toLandingSession(
  current: SavantFreeSession | null,
): Extract<SavantFreeSession, { status: 'none' }> {
  const accessTier =
    current && 'accessTier' in current ? current.accessTier : undefined
  const rateLimitsByModel = getRateLimitsByModel(current)
  const referral = getReferralInfo(current) ?? getCachedReferral()
  const countryCode =
    current && 'countryCode' in current ? current.countryCode : undefined
  const countryBlockReason =
    current && 'countryBlockReason' in current
      ? current.countryBlockReason
      : undefined
  const ipPrivacySignals =
    current && 'ipPrivacySignals' in current
      ? current.ipPrivacySignals
      : undefined

  return {
    status: 'none',
    ...(accessTier ? { accessTier } : {}),
    ...(rateLimitsByModel ? { rateLimitsByModel } : {}),
    ...(referral ? { referral } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(countryBlockReason ? { countryBlockReason } : {}),
    ...(ipPrivacySignals ? { ipPrivacySignals } : {}),
  }
}

/** Best-effort DELETE of the caller's session row, gated on actually holding
 *  one. Used both by exit paths and any flow that wants the next POST to
 *  start clean (rejoin, return-to-landing). Always swallows errors — the
 *  server-side sweep is the backstop. */
async function releaseSavantFreeSlot(): Promise<void> {
  const current = useSavantFreeSessionStore.getState().session
  if (!holdsLiveSavantFreeSlot(current)) return
  const { token } = getAuthTokenDetails()
  if (!token) return
  try {
    await callSession('DELETE', token)
  } catch {
    // swallow
  }
}

async function resetChatStore(): Promise<void> {
  const { useChatStore } = await import('../state/chat-store')
  useChatStore.getState().reset()
}

interface RestartOpts {
  resetChat?: boolean
  /** DELETE the held slot before restarting so the next POST starts clean. */
  releaseSlot?: boolean
}

async function restartSavantFreeSession(
  mode: RestartMode,
  opts: RestartOpts = {},
): Promise<void> {
  if (!IS_SAVANT_FREE) return
  // Halt the running poll loop before we touch local stores or DELETE the
  // slot. Otherwise an in-flight GET could land mid-reset and overwrite
  // state, or the next scheduled tick could fire between DELETE and
  // restart() with stale assumptions. restart() re-aborts and re-arms
  // below; the extra abort here is cheap.
  controller?.abort()
  if (opts.resetChat) await resetChatStore()
  if (opts.releaseSlot) await releaseSavantFreeSlot()
  await controller?.restart(mode)
}

/**
 * Re-POST to the server (rejoining the queue / rotating the instance id).
 * Pass `resetChat: true` to also wipe local chat history — used when
 * rejoining after a session ended so the next admitted session starts fresh.
 */
export function refreshSavantFreeSession(
  opts: { resetChat?: boolean } = {},
): Promise<void> {
  return restartSavantFreeSession('rejoin', { resetChat: opts.resetChat })
}

/**
 * Drop back to the pre-join landing state (model picker) instead of auto
 * re-queuing. Used after a session ends: the user lands on the picker so
 * they consciously choose a model and hit Enter to join, rather than being
 * silently re-queued for whatever model they last used.
 */
export function returnToSavantFreeLanding(
  opts: { resetChat?: boolean } = {},
): Promise<void> {
  return restartSavantFreeSession('landing', {
    resetChat: opts.resetChat,
    releaseSlot: true,
  })
}

/** Refresh picker-only metadata (quota and queue depths) while staying on the
 * model selection screen. Used when a midnight-Pacific session quota reset
 * passes while the landing screen is open. */
export function refreshSavantFreeLandingMetadata(): Promise<void> {
  return restartSavantFreeSession('landing')
}

/**
 * Start a session on `model` (admitted immediately server-side). Dual-purpose:
 *   - First start: called from the pre-chat landing picker. The session starts
 *     at `none` (GET-only); this is the user's explicit commitment to enter.
 *   - Switch: called when the user picks a different model from the landing
 *     screen. The server admits them on the new model right away.
 *
 * If the server has already admitted them on a different model, it responds
 * with `model_locked`; the tick loop silently reverts the local selection to
 * the locked model so the active session stays intact. Users who really want
 * to switch can /end-session deliberately.
 */
export function startSavantFreeSession(model: string): Promise<void> {
  if (!IS_SAVANT_FREE) return Promise.resolve()
  // This is the only explicit user-pick path (called from the picker on
  // click / Enter), so persistence belongs here — and ONLY here. Server-
  // driven flips (`model_locked`, `model_unavailable`, takeover) go
  // through `setSelectedModel` directly, which never writes to disk.
  const current = useSavantFreeSessionStore.getState().session
  const accessTier =
    current && 'accessTier' in current ? current.accessTier : 'full'
  useSavantFreeModelStore.getState().switchModel(model)
  return restartSavantFreeSession('rejoin')
}

export function takeOverSavantFreeSession(): Promise<void> {
  if (!IS_SAVANT_FREE) return Promise.resolve()
  const current = useSavantFreeSessionStore.getState().session
  if (current?.status !== 'takeover_prompt') return Promise.resolve()
  useSavantFreeModelStore.getState().setSelectedModel(current.model)
  return restartSavantFreeSession('rejoin')
}

/**
 * Best-effort DELETE of the caller's session row. Used by exit paths that
 * skip React unmount (process.exit on Ctrl+C) so the seat frees up quickly
 * instead of waiting for the server-side expiry sweep.
 */
export async function endSavantFreeSessionBestEffort(): Promise<void> {
  if (!IS_SAVANT_FREE) return
  await releaseSavantFreeSlot()
}

export function markSavantFreeSessionSuperseded(): void {
  if (!IS_SAVANT_FREE) return
  controller?.abort()
  controller?.apply({ status: 'superseded' })
}

/** Flip into the terminal `country_blocked` state from outside the poll loop.
 *  Used when the chat-completions gate rejects on country even though the
 *  session-level country check did not catch the request first.
 *  Transitioning the session state here unmounts the Chat surface in favor of
 *  the landing screen's country_blocked message, so the user can't keep typing
 *  and sending doomed requests. */
export function markSavantFreeSessionCountryBlocked(params: {
  countryCode: string
  countryBlockReason?: SavantFreeBlockReason
  ipPrivacySignals?: SavantFreeIpPrivacySignal[]
}): void {
  if (!IS_SAVANT_FREE) return
  controller?.abort()
  controller?.apply({ status: 'country_blocked', ...params })
  // Best-effort DELETE so we don't hold a session row the server is already
  // refusing to serve at chat time.
  releaseSavantFreeSlot().catch(() => {})
}

/** Flip into the local `ended` state without an instanceId (server has lost
 *  our row). The chat surface stays mounted with the rejoin banner.
 *  Preserves any `rateLimitsByModel` snapshot from the prior session so the
 *  banner can show today's session count without an extra fetch. */
export function markSavantFreeSessionEnded(): void {
  if (!IS_SAVANT_FREE) return
  controller?.abort()
  const current = useSavantFreeSessionStore.getState().session
  const rateLimitsByModel = getRateLimitsByModel(current)
  controller?.apply({
    status: 'ended',
    accessTier:
      current && 'accessTier' in current ? current.accessTier : undefined,
    rateLimitsByModel,
  })
}

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

    if (!IS_SAVANT_FREE) {
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
        schedule(POLL_INTERVAL_ERROR_MS)
      }
    }

    controller = {
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
          // prevent. But the picker still needs live quota snapshots, so kick
          // off a fire-and-forget GET and extract only picker metadata from
          // the response, ignoring whatever status it claims. Polling resumes
          // when the user commits to a model via startSavantFreeSession.
          const landingSession = toLandingSession(
            useSavantFreeSessionStore.getState().session,
          )
          apply(landingSession)
          const fetchController = abortController
          callSession('GET', token, { signal: fetchController.signal })
            .then((response) => {
              if (
                cancelled ||
                fetchController.signal.aborted ||
                generation !== restartGeneration
              ) {
                return
              }
              if (response.status === 'none') {
                apply({
                  status: 'none',
                  accessTier: response.accessTier ?? landingSession.accessTier,
                  rateLimitsByModel:
                    response.rateLimitsByModel ??
                    landingSession.rateLimitsByModel,
                  // Carry the referral block so the "change model" picker shows
                  // the GLM banner too (the server only attaches it to `none`).
                  referral: getReferralInfo(response) ?? landingSession.referral,
                  countryCode:
                    response.countryCode ?? landingSession.countryCode,
                  countryBlockReason:
                    response.countryBlockReason ??
                    landingSession.countryBlockReason,
                  ipPrivacySignals:
                    response.ipPrivacySignals ??
                    landingSession.ipPrivacySignals,
                })
              }
            })
            .catch(() => {
              // Silent — blank hints are acceptable if the fetch fails.
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
    }

    tick()

    return () => {
      cancelled = true
      abortController.abort()
      clearTimer()
      const current = useSavantFreeSessionStore.getState().session
      controller = null

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
