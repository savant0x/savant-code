import { describe, expect, test } from 'bun:test'

import { readRestoredContextTokenCount } from '../run-state-storage'

import type { RunState } from '@savant-code/sdk'

/**
 * Builds a minimal RunState fixture carrying the given contextTokenCount.
 * The count field is the only thing this helper reads; everything else is
 * cast to satisfy the RunState type at the call boundary.
 */
const runStateWithContextTokenCount = (count: unknown): RunState =>
  ({
    schemaVersion: 1,
    sessionState: { mainAgentState: { contextTokenCount: count } },
  }) as unknown as RunState

describe('readRestoredContextTokenCount (FID-2026-1009-002)', () => {
  test('returns the persisted count', () => {
    expect(
      readRestoredContextTokenCount(runStateWithContextTokenCount(45_000)),
    ).toBe(45_000)
  })

  test('returns null when the run state is missing', () => {
    expect(readRestoredContextTokenCount(null)).toBeNull()
    expect(readRestoredContextTokenCount(undefined)).toBeNull()
  })

  test('returns null when the session state is missing', () => {
    expect(
      readRestoredContextTokenCount({ schemaVersion: 1 } as RunState),
    ).toBeNull()
  })

  test('returns null when the count is not a number', () => {
    expect(
      readRestoredContextTokenCount(runStateWithContextTokenCount(undefined)),
    ).toBeNull()
    expect(
      readRestoredContextTokenCount(runStateWithContextTokenCount('45000')),
    ).toBeNull()
  })

  test('returns null for a non-positive count (no reading)', () => {
    expect(
      readRestoredContextTokenCount(runStateWithContextTokenCount(0)),
    ).toBeNull()
    expect(
      readRestoredContextTokenCount(runStateWithContextTokenCount(-5)),
    ).toBeNull()
  })
})
