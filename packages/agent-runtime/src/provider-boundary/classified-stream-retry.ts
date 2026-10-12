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
 * - User-initiated turns always reach the provider. An open breaker suppresses
 *   only an optional automatic retry; it never rejects the first attempt.
 *   The breaker still receives every classified outcome.
 * - Unknown shapes are logged once per distinct shape (bounded).
 */

import {
  ClassifiedProviderError,
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

/**
 * Test isolation: drop the default seen-shape memory.
 *
 * Same process-lifetime hazard as the breaker registry — `bun test` shares
 * one process, so a shape logged by an earlier file is suppressed for every
 * later file, and a suite asserting "logged once per distinct shape" sees
 * fewer entries than it produced. Tests that assert on the log pass their own
 * `seenShapes` set; this reset covers the ones that rely on the default.
 */
export function resetUnknownShapeLog(): void {
  DEFAULT_SEEN_SHAPES.clear()
}

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
    let emitted = false
    let consumerError = false
    const stream = params.create()
    let completed = false
    let primaryFailure = false
    try {
      let next = await stream.next()
      while (!next.done) {
        emitted = true
        try { yield next.value } catch (error) {
          consumerError = true
          throw error
        }
        next = await stream.next()
      }
      completed = true
      params.breaker?.recordSuccess()
      params.onSuccess?.()
      return next.value
    } catch (error) {
      primaryFailure = true
      if (consumerError) throw error
      const verdict = classifyFailure(error)
      params.breaker?.recordOutcome(verdict)
      params.onFailure?.(verdict, error)
      if (verdict.class === 'unknown' && params.onUnknownShape) {
        logUnknownShapeOnce(params.onUnknownShape, error, seenShapes)
      }
      const rateLimitOnce = verdict.reason !== 'rate-limit' || attempt < 2 // 429: one retry max
      const mayRetry =
        !emitted &&
        verdict.retryable &&
        params.policy.retryableClasses.includes(verdict.class) &&
        attempt < params.policy.maxAttempts &&
        rateLimitOnce &&
        params.breaker?.getState() !== 'open'
      if (!mayRetry) {
        throw new ClassifiedProviderError(verdict, error)
      }
      await sleep(retryDelayMs(attempt, params.policy))
    } finally {
      if (!completed) {
        try { await stream.return(undefined as R) } catch (error) {
          if (!primaryFailure) throw error
          params.onUnknownShape?.('Stream cleanup failed after primary failure')
        }
      }
    }
  }
}
