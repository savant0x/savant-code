import { useNow } from './use-now'
import { IS_FREEBUFF } from '../utils/constants'

import type { SavantFree$1 } from '../types/savant-free-session'

export interface SavantFree$1 {
  /** 0..1, fraction of the session remaining. 1 at admission, 0 at expiry. */
  fraction: number
  remainingMs: number
}

/**
 * Computes a live progress value for the active savant-free session, ticking at
 * 1Hz. Returns null outside of active state or in non-savant-free builds, so
 * callers can short-circuit their rendering.
 */
export function useFreebuffSessionProgress(
  session: SavantFree$1 | null,
): SavantFree$1 | null {
  const expiresAtMs =
    session?.status === 'active' ? Date.parse(session.expiresAt) : null
  const admittedAtMs =
    session?.status === 'active' ? Date.parse(session.admittedAt) : null

  const nowMs = useNow(1000, expiresAtMs !== null)

  if (!IS_FREEBUFF || !expiresAtMs || !admittedAtMs) return null

  const totalMs = expiresAtMs - admittedAtMs
  if (totalMs <= 0) return null
  const remainingMs = Math.max(0, expiresAtMs - nowMs)
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs))
  return { fraction, remainingMs }
}
