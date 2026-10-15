/**
 * FID-2026-1005-006 — retry-policy shape validation at load time.
 *
 * The measured session-killer from the reference project: a policy whose
 * timing keys were nested under `backoff:{}` while the scheduler read them
 * top-level produced `undefined * 2^n = NaN` delays and a persistent session
 * log rejected the non-finite values. Rule here: the policy MUST be the flat
 * shape the scheduler reads, validated BEFORE any request can observe a
 * delay (converged design decision 5).
 */

import type { FailureClass } from './failure-class'

export interface RetryPolicy {
  /** Total boundary attempts (first call + retries). Integer >= 1. */
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  retryableClasses: readonly FailureClass[]
}

const FAILURE_CLASSES: readonly FailureClass[] = [
  'transient',
  'administrative',
  'unknown',
]

/**
 * The default: one bounded in-turn retry (the measured dsh rule — 429 and
 * friends never auto-retry three times in a turn).
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  retryableClasses: ['transient'],
}

function fail(path: string, detail: string): never {
  throw new Error(`retryPolicy.${path}: ${detail}`)
}

/**
 * Validate a candidate policy against the FLAT shape the scheduler reads.
 * Throws at load time — loudly — on any mismatch, including the measured
 * nested-`backoff` defect.
 */
export function validateRetryPolicy(input: unknown): RetryPolicy {
  if (typeof input !== 'object' || input === null) {
    fail('(root)', 'expected an object')
  }
  const record = input as Record<string, unknown>
  if (record.backoff !== undefined) {
    fail(
      'backoff',
      'nested timing keys are rejected — the scheduler reads flat retryPolicy.baseDelayMs/maxDelayMs (the nested shape silently produced NaN delays)',
    )
  }
  const { maxAttempts, baseDelayMs, maxDelayMs, retryableClasses } = record
  if (
    typeof maxAttempts !== 'number' ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1
  ) {
    fail('maxAttempts', 'expected an integer >= 1')
  }
  if (
    typeof baseDelayMs !== 'number' ||
    !Number.isFinite(baseDelayMs) ||
    baseDelayMs < 0
  ) {
    fail('baseDelayMs', 'expected a finite number >= 0')
  }
  if (
    typeof maxDelayMs !== 'number' ||
    !Number.isFinite(maxDelayMs) ||
    maxDelayMs < baseDelayMs
  ) {
    fail('maxDelayMs', 'expected a finite number >= baseDelayMs')
  }
  if (!Array.isArray(retryableClasses) || retryableClasses.length === 0) {
    fail('retryableClasses', 'expected a non-empty array of failure classes')
  }
  for (const cls of retryableClasses) {
    if (!FAILURE_CLASSES.includes(cls as FailureClass)) {
      fail('retryableClasses', `unknown failure class ${String(cls)}`)
    }
  }
  // Every delay the policy can produce must be finite (the NaN lesson).
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
    if (!Number.isFinite(delay)) {
      fail('baseDelayMs', `non-finite delay at attempt ${attempt}`)
    }
  }
  return {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    retryableClasses: [...retryableClasses] as FailureClass[],
  }
}

/** Validate-or-default. Undefined → default; anything else is validated. */
export function resolveRetryPolicy(input: unknown): RetryPolicy {
  return input === undefined ? DEFAULT_RETRY_POLICY : validateRetryPolicy(input)
}

/** Capped exponential delay for the n-th boundary attempt (always finite). */
export function retryDelayMs(attempt: number, policy: RetryPolicy): number {
  const raw = policy.baseDelayMs * 2 ** (attempt - 1)
  return Math.min(
    policy.maxDelayMs,
    Number.isFinite(raw) ? raw : policy.maxDelayMs,
  )
}
