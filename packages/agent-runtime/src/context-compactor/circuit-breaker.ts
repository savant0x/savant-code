import {
  CIRCUIT_BREAKER_COOLDOWN_MS,
  CIRCUIT_BREAKER_MAX_FAILURES,
} from './state'

import type { CircuitState } from './state'
import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * Circuit breaker for compaction failures (extracted from ContextCompactor).
 *
 * Opens after `CIRCUIT_BREAKER_MAX_FAILURES` consecutive failures, half-opens
 * after the cooldown elapses, and returns to healthy on the next success.
 */
export class CircuitBreaker {
  private state: CircuitState = 'healthy'
  private failureCount = 0
  private lastFailureTime = 0
  private lastSuccessTime = 0

  // Degradation warning tracking
  private degradationWarningShown = false

  constructor(private logger: Logger) {}

  /**
   * If the breaker is open and the cooldown has elapsed, transition to
   * half-open (allowing a trial request). Returns whether requests are
   * currently allowed; when blocked, includes a human-readable reason.
   */
  checkCooldown(): { allowed: boolean; reason?: string } {
    if (this.state !== 'open') return { allowed: true }
    const elapsed = Date.now() - this.lastFailureTime
    if (elapsed > CIRCUIT_BREAKER_COOLDOWN_MS) {
      this.state = 'half-open'
      this.logger.info('Circuit breaker: half-open (cooldown elapsed)')
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: `Circuit breaker open — cooldown ${Math.ceil((CIRCUIT_BREAKER_COOLDOWN_MS - elapsed) / 60_000)}min remaining`,
    }
  }

  isOpen(): boolean {
    return this.state === 'open'
  }

  /**
   * Record a compaction result for circuit breaker tracking.
   */
  recordResult(success: boolean): void {
    if (success) {
      this.failureCount = 0
      this.lastSuccessTime = Date.now()
      if (this.state === 'half-open') {
        this.state = 'healthy'
        this.logger.info('Circuit breaker: healthy (compaction succeeded)')
      }
    } else {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= CIRCUIT_BREAKER_MAX_FAILURES) {
        this.state = 'open'
        this.logger.warn(
          { failureCount: this.failureCount },
          `Circuit breaker: open (${this.failureCount} consecutive failures, ${CIRCUIT_BREAKER_COOLDOWN_MS / 60_000}min cooldown)`,
        )
      } else if (this.state === 'half-open') {
        this.state = 'open'
        this.logger.warn('Circuit breaker: re-opened (half-open test failed)')
      }
    }
  }

  /**
   * Get degradation warning if context is approaching limits.
   */
  getDegradationWarning(): string | null {
    if (this.degradationWarningShown) return null

    if (this.state === 'open') {
      this.degradationWarningShown = true
      return '⚠️ Context compaction circuit breaker is OPEN. Auto-compaction disabled for 5 minutes due to repeated failures. Context may grow unbounded during this period.'
    }
    if (this.state === 'degraded') {
      return '⚠️ Context compaction is degraded. Some compaction attempts have failed.'
    }
    return null
  }
}
