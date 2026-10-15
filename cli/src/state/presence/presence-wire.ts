import { mapSanitizedState } from './presence-mapper'
import { sanitizeRawState, validatePayload } from './presence-privacy'
import { shouldDispatch, TokenBucket } from './presence-selector'

import type { PresenceLogger } from './presence-ipc'
import type { PresenceRawState, PresencePayload } from './presence-privacy'

/**
 * FID-2026-0818-009 step 2: the presence pipeline — the glue that composes
 * the mechanical privacy boundary into a unidirectional flow:
 *
 *   raw state → sanitize → map → validate (fail-closed) → rate-limit → service
 *
 * The pipeline holds the token bucket + last-dispatched payload so it can
 * enforce "dispatch only on delta, at most 5 / 20 s". It is deliberately
 * store-agnostic (a plain object) — the Zustand `subscribe` wiring is a thin
 * caller; the pipeline itself is unit-testable without a live TUI or Discord.
 */

export type PresenceSink = {
  update: (payload: PresencePayload) => Promise<void> | void
}

export type PresencePipeline = {
  /** Feed one raw snapshot through the pipeline. */
  push: (raw: PresenceRawState) => void
  /** The last dispatched payload (for tests/observability). */
  lastPayload: () => PresencePayload | null
}

export function createPresencePipeline(options: {
  sink: PresenceSink
  logger?: PresenceLogger
  startTimestamp?: number
  bucket?: TokenBucket
}): PresencePipeline {
  const startTimestamp = options.startTimestamp ?? Date.now()
  const bucket = options.bucket ?? new TokenBucket()
  let last: PresencePayload | null = null

  return {
    push(raw: PresenceRawState): void {
      const sanitized = sanitizeRawState(raw)
      const mapped = mapSanitizedState(sanitized, startTimestamp)
      const { ok, payload, errors } = validatePayload(mapped)
      if (!ok && errors) {
        options.logger?.warn?.(
          `discord presence payload rejected (fail-closed): ${errors.join('; ')}`,
        )
      }
      if (shouldDispatch(bucket, last, payload)) {
        last = payload
        void options.sink.update(payload)
      }
    },
    lastPayload: () => last,
  }
}

/**
 * Subscribe a pipeline to a store. `subscribe(fn)` returns an unsubscribe
 * function (Zustand's `useChatStore.subscribe` contract). The first tick runs
 * immediately so the presence reflects the current state without waiting for
 * the next mutation.
 */
export function subscribeToPresence(
  getSnapshot: () => PresenceRawState,
  subscribe: (fn: () => void) => () => void,
  pipeline: PresencePipeline,
): () => void {
  const tick = (): void => pipeline.push(getSnapshot())
  tick()
  return subscribe(tick)
}
