/**
 * FID-2026-1005-006 — failure taxonomy applied BEFORE any retry decision.
 *
 * Retry, failover, and breaker state all consume the class, never raw error
 * strings (converged design decision 2). Closed table; every unrecognized
 * shape is `unknown` with `retryable: false` — the conservative default both
 * reference projects converged on (a mis-shaped error is never blindly
 * retried).
 */

export type FailureClass = 'transient' | 'administrative' | 'unknown'

export type FailureReason =
  | 'timeout'
  | 'network'
  | 'rate-limit'
  | 'server'
  | 'auth'
  | 'permission'
  | 'invalid-request'
  | 'model-unavailable'
  | 'unrecognized'

export interface FailureVerdict {
  class: FailureClass
  reason: FailureReason
  retryable: boolean
}

/** Retry is a property of the class, never of a raw string. */
const RETRYABLE: Record<FailureClass, boolean> = {
  transient: true,
  administrative: false,
  unknown: false,
}

function verdict(
  className: FailureClass,
  reason: FailureReason,
): FailureVerdict {
  return { class: className, reason, retryable: RETRYABLE[className] }
}

function nameOf(input: unknown): string {
  return input instanceof Error ? input.name : ''
}

function messageOf(input: unknown): string {
  return input instanceof Error ? input.message.toLowerCase() : ''
}

function codeOf(input: unknown): string {
  if (typeof input !== 'object' || input === null) return ''
  const code = (input as Record<string, unknown>).code
  return typeof code === 'string' ? code : ''
}

function statusOf(input: unknown): number | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const record = input as Record<string, unknown>
  for (const value of [
    record.status,
    record.statusCode,
    record.httpStatus,
    (record.response as Record<string, unknown> | undefined)?.status,
  ]) {
    if (typeof value === 'number' && Number.isInteger(value)) return value
  }
  return undefined
}

const NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
])

/**
 * Classify one provider-boundary failure. Pure; the exhaustive table is
 * pinned by `failure-classification.test.ts`.
 */
export function classifyFailure(input: unknown): FailureVerdict {
  const status = statusOf(input)
  if (status !== undefined) {
    if (status === 429) return verdict('transient', 'rate-limit')
    if (status === 408) return verdict('transient', 'timeout')
    if (status >= 500) return verdict('transient', 'server')
    if (status === 401) return verdict('administrative', 'auth')
    if (status === 403) return verdict('administrative', 'permission')
    if (status === 400 || status === 422)
      return verdict('administrative', 'invalid-request')
    if (status === 404) return verdict('administrative', 'model-unavailable')
  }
  const name = nameOf(input)
  const code = codeOf(input)
  // A user abort must never be retried: conservative `unknown`.
  if (name === 'AbortError') return verdict('unknown', 'unrecognized')
  if (name === 'TimeoutError' || code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT')
    return verdict('transient', 'timeout')
  if (NETWORK_CODES.has(code)) return verdict('transient', 'network')
  if (/timed? ?out/.test(messageOf(input))) return verdict('transient', 'timeout')
  return verdict('unknown', 'unrecognized')
}

/** A failure surfaced with its verdict — consumers switch on `verdict`. */
export class ClassifiedProviderError extends Error {
  constructor(
    readonly verdict: FailureVerdict,
    readonly cause: unknown,
  ) {
    super(
      `provider call failed (${verdict.class}/${verdict.reason})`,
      cause instanceof Error ? { cause } : undefined,
    )
    this.name = 'ClassifiedProviderError'
  }
}

/** The boundary gate refused the call (breaker open) — not a provider verdict. */
export class ProviderBoundaryBlockedError extends Error {
  constructor(reason: string) {
    super(`provider call blocked: ${reason}`)
    this.name = 'ProviderBoundaryBlockedError'
  }
}

/**
 * Log each distinct unrecognized shape exactly once (bounded) so the
 * taxonomy can grow from evidence. Returns true when this shape was new.
 */
export function logUnknownShapeOnce(
  log: (message: string) => void,
  input: unknown,
  seen: Set<string>,
): boolean {
  // Log structural keys only. Error messages and object values can carry
  // credentials or prompt text and must never enter telemetry (Law 12).
  const shape =
    typeof input === 'object' && input !== null
      ? `${input instanceof Error ? 'error' : Array.isArray(input) ? 'array' : 'object'}:${Object.keys(input).sort().join(',')}`
      : typeof input
  if (seen.has(shape)) return false
  seen.add(shape)
  log(`unrecognized provider failure shape (taxonomy growth): ${shape}`)
  return true
}
