/**
 * FID-2026-0915-004 — vocabulary modernization pins.
 *
 * Pins the operator ruling in enforcement: `converged` is an admissible
 * ACTIVE-queue ledger status (Perfection Loop complete, awaiting
 * implementation approval); `fixed`/`verified`/`created`/`analyzed` remain
 * admitted (deprecated-but-accepted); `closed` still is NOT active-queue
 * legal. The receipt contract is untouched: VERIFIED_STATUSES stays
 * `fixed | verified` — receipts verify implementation, and `converged`
 * is explicitly pre-implementation.
 */
import { describe, expect, test } from 'bun:test'

import { VERIFIED_STATUSES } from '../fid-gates'
import { ALLOWED_ACTIVE_STATUSES } from '../fid-ledger'

describe('FID status vocabulary (FID-2026-0915-004)', () => {
  test('converged is an admissible active-queue status', () => {
    expect(ALLOWED_ACTIVE_STATUSES.has('converged')).toBe(true)
  })

  test('legacy statuses remain accepted — nothing was removed', () => {
    for (const status of ['created', 'analyzed', 'fixed', 'verified']) {
      expect(ALLOWED_ACTIVE_STATUSES.has(status)).toBe(true)
    }
    expect(ALLOWED_ACTIVE_STATUSES.size).toBe(5)
  })

  test('closed is still not active-queue legal', () => {
    expect(ALLOWED_ACTIVE_STATUSES.has('closed')).toBe(false)
  })

  test('receipt contract unchanged — converged does not satisfy the gate check', () => {
    expect(VERIFIED_STATUSES.has('fixed')).toBe(true)
    expect(VERIFIED_STATUSES.has('verified')).toBe(true)
    expect(VERIFIED_STATUSES.has('converged')).toBe(false)
  })
})
