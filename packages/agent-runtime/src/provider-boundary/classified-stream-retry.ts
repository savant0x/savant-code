/**
 * FID-2026-1005-006 — the provider boundary that owns retries.
 *
 * Wraps one stream-generator factory (`PromptAiSdkStreamFn` returns
 * `AsyncGenerator<StreamChunk, PromptResult<…>>`, so failures surface during
 * iteration, not as a rejected promise). Rules from the converged design:
 *
 * - Classify, then decide: only `transient`-classed failures may retry,
 *   and only when NOTHING was emitted yet (a partially-emitted stream is
 *   never re-issued — that is FID-2026-1005-007 territory and a duplication
 *   risk).
 * - 429 (rate-limit) is retried at most ONCE per logical turn (measured
 *   dsh rule), regardless of policy.maxAttempts.
 * - The breaker gates every attempt and receives every classified outcome.
 * - Unknown shapes are logged once per distinct shape (bounded).
 */

import {
  ClassifiedProviderError,
  ProviderBoundaryBlockedError,
  classifyFailure,
  logUnknownShapeOnce,
} from './failure-class'
import { retryDelayMs } from './retry-policy'

import type { FailureVerdict } from './failure-class'
import type { ProviderCircuitBreaker } from './provider-circuit-breaker'
import type { RetryPolicy } from './retry-policy'

export interface ClassifiedStreamRetryParams<C, R> {
  policy: RetryPolicy
  breaker?: ProviderCircuitBreaker
  create: () => AsyncGenerator<C, R>
  /** Injected for tests (DI, no module mocking). */
  sleep?: (ms: number) => Promise<void>
  onUnknownShape?: (message: string) => void
  onFailure?: (verdict: FailureVerdict, cause: unknown) => void
  onSuccess?: () => void
  /** Defaults to a process-lifetime set so the log stays bounded. */
  seenShapes?: Set<string>
}

/** Process-lifetime bound: each distinct unknown shape logs once. */
const DEFAULT_SEEN_SHAPES = new Set<string>()

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Run one logical turn's stream under classified retry. Returns the same
 * generator shape the SDK call returns.
 */
export async function* runWithClassifiedRetry<C, R>(
  params: ClassifiedStreamRetryParams<C, R>,
): AsyncGenerator<C, R> {
  const sleep = params.sleep ?? defaultSleep
  const seenShapes = params.seenShapes ?? DEFAULT_SEEN_SHAPES
  let attempt = 0
  for (;;) {
    attempt++
    const gate = params.breaker?.checkCooldown()
    if (gate && !gate.allowed) {
      throw new ProviderBoundaryBlockedError(gate.reason ?? 'breaker open')
    }
    let emitted = false
    try {
      const stream = params.create()
      let next = await stream.next()
      while (!next.done) {
        emitted = true
        yield next.value
        next = await stream.next()
      }
      params.breaker?.recordSuccess()
      params.onSuccess?.()
      return next.value
    } catch (error) {
      const verdict = classifyFailure(error)
      params.breaker?.recordOutcome(verdict)
      params.onFailure?.(verdict, error)
      if (verdict.class === 'unknown' && params.onUnknownShape) {
        logUnknownShapeOnce(params.onUnknownShape, error, seenShapes)
      }
      const rateLimitOnce =
        verdict.reason !== 'rate-limit' || attempt < 2 // 429: one retry max
      const mayRetry =
        !emitted &&
        verdict.retryable &&
        params.policy.retryableClasses.includes(verdict.class) &&
        attempt < params.policy.maxAttempts &&
        rateLimitOnce
      if (!mayRetry) {
        throw new ClassifiedProviderError(verdict, error)
      }
      await sleep(retryDelayMs(attempt, params.policy))
    }
  }
}
