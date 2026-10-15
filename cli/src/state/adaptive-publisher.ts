/**
 * Adaptive publisher — size-aware throttled state streaming
 * (FID-2026-1006-002 WP10, adopted from the pi harness `AdaptivePublisher`).
 *
 * The CLI renders state that changes far faster than it can be drawn: token
 * deltas, tool-output chunks, agent events. Publishing every dirty state costs
 * proportionally to the SIZE of what is published, so a fixed throttle is
 * wrong in both directions — too slow for a one-line status, too eager for a
 * multi-megabyte transcript append.
 *
 * The rule implemented here: the first dirty state after idle is published
 * IMMEDIATELY; every publication then buys a quiet delay proportional to the
 * encoded size of the value it just published, floored at `minIntervalMs` and
 * capped at `maxIntervalMs`. States that arrive while that delay is unelapsed
 * are coalesced — only the LATEST value is kept, and exactly ONE trailing
 * timer guarantees it is eventually published. So a burst of small updates
 * costs one publication per interval rather than one per update, and a burst
 * of large ones cannot saturate the render path.
 *
 * `delay = clamp(ceil(encodedSize / bytesPerMs), minIntervalMs, maxIntervalMs)`
 * with `bytesPerMs = 512` by default: millisecond of quiet per half-kilobyte
 * published. Every knob is injectable, so a test drives it deterministically
 * with a fake clock and a manual timer queue instead of sleeping.
 *
 * Commit-before-delivery: the publisher updates its own bookkeeping (clears
 * the pending value, buys the next delay) BEFORE it calls `publish`, so a
 * `markDirty` that happens re-entrantly inside `publish` is already a new
 * dirty state of the next window, never a value that is republished.
 *
 * `flush()` is the authoritative escape hatch: it publishes the pending value
 * at once, cancels the trailing timer, and RESETS the publisher to idle (an
 * explicit flush is a synchronization point, so the next dirty state is
 * published immediately rather than waiting out a stale delay).
 *
 * This module is pure orchestration: it holds no timer globals and touches no
 * stream. The caller supplies `now`/`schedule`, which makes every timing
 * behaviour assertable.
 */

/** Default floor for the post-publication delay. */
export const DEFAULT_MIN_INTERVAL_MS = 16

/** Default ceiling for the post-publication delay. */
export const DEFAULT_MAX_INTERVAL_MS = 250

/** Milliseconds of quiet bought per byte published (512 B/ms by default). */
export const DEFAULT_BYTES_PER_MS = 512

export type AdaptivePublisherOptions<T> = {
  /**
   * Deliver a value. Called synchronously and AFTER the publisher's own
   * bookkeeping for that publication, so a re-entrant `markDirty` inside a
   * delivery is a new window (commit-before-delivery).
   */
  publish: (value: T) => void
  /** Encoded size of a value, in bytes — what the next delay is bought from. */
  encodeSize: (value: T) => number
  /** Injected clock, in milliseconds. */
  now: () => number
  /** Injected scheduler; returns a cancel function for the armed timer. */
  schedule: (run: () => void, delayMs: number) => () => void
  /** Delay floor. Default `DEFAULT_MIN_INTERVAL_MS`. */
  minIntervalMs?: number
  /** Delay ceiling. Default `DEFAULT_MAX_INTERVAL_MS`. */
  maxIntervalMs?: number
  /** Size→delay divisor. Default `DEFAULT_BYTES_PER_MS`. */
  bytesPerMs?: number
}

export type AdaptivePublisher<T> = {
  /**
   * Record a new state. Publishes immediately when the publisher is idle or
   * its delay has elapsed; otherwise keeps only the latest value and arms one
   * trailing timer.
   */
  markDirty: (value: T) => void
  /** Publish the pending value now, cancel the timer, return to idle. */
  flush: () => void
  /** Whether a value is waiting for the trailing timer. */
  isPending: () => boolean
}

export function createAdaptivePublisher<T>(
  options: AdaptivePublisherOptions<T>,
): AdaptivePublisher<T> {
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
  const maxIntervalMs = options.maxIntervalMs ?? DEFAULT_MAX_INTERVAL_MS
  const bytesPerMs = options.bytesPerMs ?? DEFAULT_BYTES_PER_MS

  /** The value waiting for the trailing timer, if any. */
  let pending: { value: T } | undefined
  /** Cancel handle for the armed trailing timer, if any. */
  let cancelTimer: (() => void) | undefined
  /** Earliest time the next publication may happen; `undefined` = idle. */
  let nextAllowedAt: number | undefined

  const delayFor = (size: number): number =>
    Math.min(
      maxIntervalMs,
      Math.max(minIntervalMs, Math.ceil(size / bytesPerMs)),
    )

  const publishNow = (value: T): void => {
    pending = undefined
    if (cancelTimer) {
      cancelTimer()
      cancelTimer = undefined
    }
    // Buy the next delay from THIS publication before it is delivered, so a
    // re-entrant markDirty inside publish() belongs to the next window.
    nextAllowedAt = options.now() + delayFor(options.encodeSize(value))
    options.publish(value)
  }

  const markDirty = (value: T): void => {
    pending = { value }
    // A trailing timer is already armed and will publish the latest value;
    // coalescing is exactly this early return.
    if (cancelTimer) return
    const wait = nextAllowedAt === undefined ? 0 : nextAllowedAt - options.now()
    if (wait <= 0) {
      publishNow(value)
      return
    }
    cancelTimer = options.schedule(() => {
      cancelTimer = undefined
      const latest = pending
      if (latest) publishNow(latest.value)
    }, wait)
  }

  const flush = (): void => {
    if (cancelTimer) {
      cancelTimer()
      cancelTimer = undefined
    }
    const latest = pending
    pending = undefined
    // An authoritative flush is a synchronization point: return to idle so the
    // next dirty state publishes immediately.
    nextAllowedAt = undefined
    if (latest) options.publish(latest.value)
  }

  return {
    markDirty,
    flush,
    isPending: () => pending !== undefined,
  }
}
