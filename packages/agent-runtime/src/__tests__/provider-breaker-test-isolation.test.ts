/**
 * FID-2026-1007-001 — the process-lifetime breaker registry must not leak
 * across test files.
 *
 * `providerBreakers` is module-level by design (one breaker per serving
 * connection, shared across turns in the process), and `bun test` runs every
 * file in ONE process. Suites that drive three transient failures on the
 * shared `legacy:<clientSessionId>` key — fixtures reuse one literal session
 * id, unlike production's per-session ids — left the circuit OPEN for the full
 * 30-minute cooldown, and every later turn then blocked at the provider
 * boundary before any physical request: 76 failures from one process, with
 * `getLlmCallCount()` reading 0 as the tell.
 *
 * `test/setup-test-isolation.ts` (the agent-runtime test preload) calls
 * `resetProviderCircuitBreakers()` between cases. This file pins that the hook
 * restores a closed circuit AND that the registry is shared process state —
 * the second half is why the preload is load-bearing rather than decorative.
 */
import { beforeEach, describe, expect, test } from 'bun:test'

import {
  PROVIDER_BREAKER_MAX_FAILURES,
  providerCircuitBreakerFor,
  resetProviderCircuitBreakers,
} from '../provider-boundary/provider-circuit-breaker'

import type { FailureVerdict } from '../provider-boundary/failure-class'

const TRANSIENT: FailureVerdict = {
  class: 'transient',
  reason: 'server',
  retryable: true,
}
/** The key every fixture shares: `legacy:` + the literal fixture session id. */
const SHARED_KEY = 'legacy:test-session'

// The preload's `beforeEach`, restated locally so this file also exercises the
// reset when run alone (`bun test <this file>` does not load the preload).
beforeEach(() => resetProviderCircuitBreakers())

function tripSharedKey(): void {
  for (let i = 0; i < PROVIDER_BREAKER_MAX_FAILURES; i += 1) {
    providerCircuitBreakerFor(SHARED_KEY).recordOutcome(TRANSIENT)
  }
}

describe('provider breaker test isolation (FID-2026-1007-001)', () => {
  test('three transient failures on the shared key open the circuit', () => {
    tripSharedKey()
    expect(providerCircuitBreakerFor(SHARED_KEY).getState()).toBe('open')
    expect(providerCircuitBreakerFor(SHARED_KEY).checkCooldown().allowed).toBe(
      false,
    )
  })

  test('an open circuit on the shared key survives into a later case', () => {
    // The leak class, pinned directly: the registry is process-lifetime, so an
    // open circuit recorded here is still open for the next file unless
    // something resets it. Removing the preload turns this assertion red.
    tripSharedKey()
    expect(providerCircuitBreakerFor(SHARED_KEY).checkCooldown().allowed).toBe(
      false,
    )
  })

  test('this case starts closed: the reset ran between cases', () => {
    // Passes only because every case is preceded by the reset; without it the
    // verdict above carried over.
    expect(providerCircuitBreakerFor(SHARED_KEY).getState()).toBe('closed')
    expect(providerCircuitBreakerFor(SHARED_KEY).checkCooldown()).toEqual({
      allowed: true,
    })
  })

  test('reset clears the registry rather than closing the cached instance', () => {
    tripSharedKey()
    const before = providerCircuitBreakerFor(SHARED_KEY)
    resetProviderCircuitBreakers()
    const after = providerCircuitBreakerFor(SHARED_KEY)
    expect(after).not.toBe(before)
    expect(after.getState()).toBe('closed')
  })
})
