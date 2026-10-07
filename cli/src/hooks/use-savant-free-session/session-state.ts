import {
  getRateLimitsByModel,
  getReferralInfo,
} from '@savant-code/common/types/savant-free-session'

import { callSession } from './session-api'
import { useSavantFreeModelStore } from '../../state/savant-free-model-store'
import { useSavantFreeSessionStore } from '../../state/savant-free-session-store'
import { getAuthTokenDetails } from '../../utils/auth'
import { IS_SAVANT_FREE } from '../../utils/constants'
import { getCachedReferral } from '../../utils/savant-free-referral-cache'

import type { SavantFreeSession } from '../../types/savant-free-session'
import type {
  SavantFreeBlockReason,
  SavantFreeIpPrivacySignal,
} from '@savant-code/common/types/savant-free-session'

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
export type RestartMode = 'rejoin' | 'landing'
export interface PollController {
  /** Cancel the in-flight tick + timer and start a fresh one in `mode`. */
  restart: (mode: RestartMode) => Promise<void>
  apply: (next: SavantFreeSession) => void
  abort: () => void
}
let controller: PollController | null = null
export function setPollController(next: PollController | null): void {
  controller = next
}
/** Test isolation: drops the registered poll controller so a later file starts
 *  with no live poll loop — process-lifetime state `bun test` shares across
 *  files (FID-2026-1007-002). */
export function resetPollController(): void {
  controller = null
}
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
export function toLandingSession(current: SavantFreeSession | null): Extract<
  SavantFreeSession,
  {
    status: 'none'
  }
> {
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
export async function resetChatStore(): Promise<void> {
  const { useChatStore } = await import('../../state/chat-store')
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
  opts: {
    resetChat?: boolean
  } = {},
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
  opts: {
    resetChat?: boolean
  } = {},
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
