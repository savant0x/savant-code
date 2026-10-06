/**
 * FID-2026-1005-006 — per-provider circuit breaker.
 *
 * Same FSM shape as the in-tree compaction precedent
 * (`context-compactor/circuit-breaker.ts`: `checkCooldown`/`recordResult`),
 * with the reference vocabulary `closed | open | half_open` (`healthy` in the
 * compaction breaker == `closed` here). Unification deferred — YAGNI until a
 * third consumer appears (converged design decision 4).
 *
 * Measured schedule (dsh): cooldown base 30 min, exponential to a 120 min
 * cap on repeated probe failure; manual reprobe/startup never throttled.
 * Breaker state is purely reachability: only TRANSIENT failures count;
 * `administrative` and `unknown` verdicts neither trip nor reset.
 */

import type { FailureVerdict } from './failure-class'

export const PROVIDER_BREAKER_MAX_FAILURES = 3
export const PROVIDER_BREAKER_COOLDOWN_BASE_MS = 30 * 60_000
export const PROVIDER_BREAKER_COOLDOWN_MAX_MS = 120 * 60_000

export type BreakerState = 'closed' | 'open' | 'half_open'

export class ProviderCircuitBreaker {
  private state: BreakerState = 'closed'
  private consecutiveTransientFailures = 0
  private cooldownMs = PROVIDER_BREAKER_COOLDOWN_BASE_MS
  private reopenAt = 0
  private probeInFlight = false

  constructor(private readonly clock: () => number = Date.now) {}

  /**
   * Gate one call. `half_open` admits exactly ONE bounded probe at a time;
   * an elapsed `open` cooldown transitions to `half_open` and the caller's
   * next attempt IS the probe.
   */
  checkCooldown(): { allowed: boolean; reason?: string } {
    if (this.state === 'closed') return { allowed: true }
    if (this.state === 'half_open') {
      if (this.probeInFlight) {
        return {
          allowed: false,
          reason: 'Circuit breaker half-open — bounded probe already in flight',
        }
      }
      this.probeInFlight = true
      return { allowed: true }
    }
    const now = this.clock()
    if (now >= this.reopenAt) {
      this.state = 'half_open'
      this.probeInFlight = true
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: `Circuit breaker open — ${Math.ceil((this.reopenAt - now) / 60_000)}min cooldown remaining`,
    }
  }

  /** Record a classified outcome. Only `transient` speaks to breaker state. */
  recordOutcome(verdict: FailureVerdict): void {
    if (verdict.class !== 'transient') return
    this.probeInFlight = false
    if (this.state === 'half_open') {
      // Probe failed → reopen with escalated cooldown (30→120 min, capped).
      this.state = 'open'
      this.cooldownMs = Math.min(
        PROVIDER_BREAKER_COOLDOWN_MAX_MS,
        this.cooldownMs * 2,
      )
      this.reopenAt = this.clock() + this.cooldownMs
      return
    }
    this.consecutiveTransientFailures++
    if (this.consecutiveTransientFailures >= PROVIDER_BREAKER_MAX_FAILURES) {
      this.state = 'open'
      this.cooldownMs = PROVIDER_BREAKER_COOLDOWN_BASE_MS
      this.reopenAt = this.clock() + this.cooldownMs
    }
  }

  /** A success closes the circuit and resets every counter (probe or not). */
  recordSuccess(): void {
    this.state = 'closed'
    this.consecutiveTransientFailures = 0
    this.cooldownMs = PROVIDER_BREAKER_COOLDOWN_BASE_MS
    this.probeInFlight = false
  }

  /** Manual reprobe / startup / exit-change: never throttled (measured rule). */
  forceProbe(): void {
    this.state = 'half_open'
    this.probeInFlight = false
  }

  getState(): BreakerState {
    return this.state
  }
}

/** One breaker per serving connection, shared across turns in this process. */
const providerBreakers = new Map<string, ProviderCircuitBreaker>()

export function providerCircuitBreakerFor(connectionKey: string): ProviderCircuitBreaker {
  let breaker = providerBreakers.get(connectionKey)
  if (breaker === undefined) {
    breaker = new ProviderCircuitBreaker()
    providerBreakers.set(connectionKey, breaker)
  }
  return breaker
}
