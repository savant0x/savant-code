import { env } from '@savant-code/common/env'

import { isDirectProviderMode } from '../../utils/env'

import type { SavantFreeSession } from '../../types/savant-free-session'

const POLL_INTERVAL_ACTIVE_MS = 30000
const POLL_INTERVAL_ERROR_MS = 10000
/** Cap on any single session API call. Without it the only abort is the
 *  poll-loop restart controller, so a hung request (overloaded server, dead
 *  LB connection) pins the landing screen's "Starting…" spinner until Bun's
 *  ~300s idle fetch timeout. On timeout the tick loop's catch sees a
 *  non-restart abort, logs, and reschedules on POLL_INTERVAL_ERROR_MS. */
const SESSION_FETCH_TIMEOUT_MS = 20000
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
export const playAdmissionSound = () => {
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
export async function callSession(
  method: 'POST' | 'GET' | 'DELETE',
  token: string,
  opts: {
    instanceId?: string
    model?: string
    signal?: AbortSignal
  } = {},
): Promise<SavantFreeSession> {
  if (isDirectProviderMode()) {
    return { status: 'none' }
  }
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
export function nextDelayMs(next: SavantFreeSession): number | null {
  switch (next.status) {
    case 'active':
      // Poll at the normal cadence, but ensure we land just after
      // `expires_at` so the transition shows up promptly instead of leaving
      // the countdown stuck at 0 for up to a full interval.
      return Math.max(
        1000,
        Math.min(POLL_INTERVAL_ACTIVE_MS, next.remainingMs + 1000),
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

export const POLL_TIMINGS = {
  active: POLL_INTERVAL_ACTIVE_MS,
  error: POLL_INTERVAL_ERROR_MS,
}
