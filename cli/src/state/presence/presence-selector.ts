/**
 * FID-2026-0818-009: presence selector — token-bucket rate limit + delta gate.
 *
 * Discord rate-limits SET_ACTIVITY to 5 updates / 20 s. The selector caps
 * dispatch at that ceiling by construction: a token bucket refilling one token
 * every 4 s (capacity 5) plus a delta comparison that skips identical
 * snapshots. Highly transient states (a sub-agent spinning up in 500 ms) are
 * therefore never forwarded — observers see a stable, macroscopic view.
 */

export const DISCORD_RATE_CAPACITY = 5
export const DISCORD_RATE_REFILL_MS = 4000

/** Token bucket with a fixed refill cadence; capacity 5 / 4 s per token. */
export class TokenBucket {
  private tokens: number
  private lastRefillAt: number

  constructor(
    private readonly capacity: number = DISCORD_RATE_CAPACITY,
    private readonly refillMs: number = DISCORD_RATE_REFILL_MS,
    now: number = Date.now(),
  ) {
    this.tokens = capacity
    this.lastRefillAt = now
  }

  /** Attempt to consume one token. Returns true when a token was available. */
  tryAcquire(now: number = Date.now()): boolean {
    const elapsed = now - this.lastRefillAt
    if (elapsed >= this.refillMs) {
      const refilled = Math.floor(elapsed / this.refillMs)
      this.tokens = Math.min(this.capacity, this.tokens + refilled)
      this.lastRefillAt += refilled * this.refillMs
    }
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    return false
  }
}

/**
 * Decide whether to dispatch a new snapshot: only when it differs from the
 * last dispatched snapshot AND the bucket has a token. Serializes the
 * snapshots with `JSON.stringify` — a deterministic, order-preserving delta.
 */
export function shouldDispatch(
  bucket: TokenBucket,
  last: unknown,
  next: unknown,
  now: number = Date.now(),
): boolean {
  if (JSON.stringify(last) === JSON.stringify(next)) return false
  return bucket.tryAcquire(now)
}
