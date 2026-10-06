/**
 * FID-2026-1005-008 — availability verdict taxonomy (converged design
 * decision 1). Infrastructure faults must never masquerade as facts about
 * models:
 *
 * - `declared-not-routed` (a VERDICT): the provider explicitly says the
 *   model will not route — recorded with reason + observation time, the
 *   only class that hides a model from advertised lists, auto-restored by
 *   a later `routable` observation.
 * - `gateway-fault`: 5xx / 429 / timeout / network / parse — NOT a verdict;
 *   the model stays reachable.
 * - `eligibility-gated`: region/account-qualified — its own group, never a
 *   rejection.
 *
 * Classification keys on BODY SHAPE first, never on the error's existence
 * (the measured failure: an error object carrying `status: 200` with an
 * SSE body made fully available models vanish for a round). An undecodable
 * body is `gateway-fault{parse}` REGARDLESS of the HTTP status it arrived
 * with.
 *
 * Cross-FID note (006 coordination, decision 6): the fault kinds mirror
 * the transient reasons of the agent-runtime failure taxonomy 1:1 —
 * `server→5xx`, `rate-limit→429`, `timeout→timeout`, `network→network`
 * (the reference's own non-verdict list includes offline/断网; the converged
 * design's four-kind list is widened to five here as an audited
 * refinement). `parse` is this module's own body-shape case.
 */

export type GatewayFaultKind = '5xx' | '429' | 'timeout' | 'network' | 'parse'

/** The mirrored transient-reason names from the FID-2026-1005-006 taxonomy. */
export const GATEWAY_FAULT_FROM_FAILURE_REASON: Readonly<
  Record<string, GatewayFaultKind>
> = {
  server: '5xx',
  'rate-limit': '429',
  timeout: 'timeout',
  network: 'network',
}

export type AvailabilityVerdict =
  | { class: 'routable'; observedAt: number }
  | { class: 'declared-not-routed'; reason: string; observedAt: number }
  | { class: 'gateway-fault'; kind: GatewayFaultKind }
  | { class: 'eligibility-gated'; kind: 'region' | 'account' }

export interface AvailabilityObservation {
  /** HTTP status the probe saw, when any. */
  httpStatus?: number
  /** Whether the response body decoded to the expected shape. */
  bodyDecoded: boolean
  /** The provider explicitly refused to route this model. */
  rejected?: { reason: string }
  /** The model is qualified-gated, not rejected. */
  gated?: 'region' | 'account'
  /** A transport-level failure was observed. */
  transport?: 'timeout' | 'network'
  observedAt: number
}

/**
 * Classify one probe observation. Pure; table pinned by
 * `availability-verdict.test.ts`.
 */
export function classifyAvailabilityObservation(
  observation: AvailabilityObservation,
): AvailabilityVerdict {
  // Body shape first: an undecodable body is a parse fault, never a
  // verdict — regardless of the HTTP status it arrived with.
  if (!observation.bodyDecoded) return { class: 'gateway-fault', kind: 'parse' }
  if (observation.gated) {
    return { class: 'eligibility-gated', kind: observation.gated }
  }
  if (observation.rejected) {
    return {
      class: 'declared-not-routed',
      reason: observation.rejected.reason,
      observedAt: observation.observedAt,
    }
  }
  if (observation.transport) {
    return { class: 'gateway-fault', kind: observation.transport }
  }
  const status = observation.httpStatus
  if (status !== undefined) {
    if (status === 429) return { class: 'gateway-fault', kind: '429' }
    if (status >= 500) return { class: 'gateway-fault', kind: '5xx' }
  }
  return { class: 'routable', observedAt: observation.observedAt }
}

/**
 * Visibility rule: only a verdict hides a model. A gateway fault keeps it
 * reachable; a later routable observation restores it automatically.
 */
export function isVisibleInAdvertisedLists(
  verdict: AvailabilityVerdict,
): boolean {
  return verdict.class !== 'declared-not-routed'
}
