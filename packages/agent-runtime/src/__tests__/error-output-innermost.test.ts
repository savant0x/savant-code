/**
 * FID-2026-1007-001 — a wrapped loop failure must report the provider's real
 * message, not the boundary wrapper's machine-readable label.
 *
 * `buildLoopErrorOutput` reads `apiErrorDetails.message` first; for a failure
 * carrying no status code and no parsed API-error body that is undefined, so
 * the user-facing text comes from the fallback path. Before the correction
 * that path read the OUTERMOST error, which for every boundary-wrapped failure
 * is `ClassifiedProviderError`'s own label (`provider call failed (…)`) — so
 * the operator was shown a class name instead of what the provider said.
 * `innermostError` is private; this file pins the behaviour through the public
 * seam.
 */
import { describe, expect, test } from 'bun:test'

import { buildLoopErrorOutput } from '../run-agent-step/error-output'

const signal = new AbortController().signal

describe('loop error output reports the innermost error (FID-2026-1007-001)', () => {
  test('a boundary-wrapped failure reports the provider message, not the label', () => {
    const wrapped = new Error('provider call failed (unknown/unrecognized)', {
      cause: new Error('Upstream provider returned 529 overloaded'),
    })
    const { errorMessage, status } = buildLoopErrorOutput({
      error: wrapped,
      signal,
    })
    expect(status).toBe('failed')
    expect(errorMessage).toContain('Upstream provider returned 529 overloaded')
    expect(errorMessage).not.toContain('provider call failed')
  })

  test('the deepest error wins through a multi-level chain', () => {
    const wrapped = new Error('provider call failed (transient)', {
      cause: new Error('fetch layer', {
        cause: new Error('socket hang up'),
      }),
    })
    expect(
      buildLoopErrorOutput({ error: wrapped, signal }).errorMessage,
    ).toContain('socket hang up')
  })

  test('a non-Error cause leaves the wrapper message in place', () => {
    // The chain walk stops at the first non-Error cause, mirroring
    // `isAbortError`'s boundary — stated, so the limit is pinned rather than
    // discovered.
    const wrapped = new Error('provider call failed (unknown)', {
      cause: 'string cause',
    })
    expect(
      buildLoopErrorOutput({ error: wrapped, signal }).errorMessage,
    ).toContain('provider call failed (unknown)')
  })
})
