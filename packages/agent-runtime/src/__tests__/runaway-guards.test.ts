import { describe, expect, test } from 'bun:test'

import {
  CONSECUTIVE_TOOL_ERROR_LIMIT,
  REPEATED_TOOL_CALL_LIMIT,
  THINK_ONLY_LIMIT,
  buildToolCallSignature,
  initialRunawayGuardCounters,
  updateAndEvaluateRunawayGuards,
} from '../run-agent-step/runaway-guards'

import type { RunawayGuardCounters } from '../run-agent-step/runaway-guards'

describe('FID-2026-0822-002 runaway guards', () => {
  const inputOf = (overrides: {
    toolSignature?: string
    hadToolCallError?: boolean
    isThinkOnly?: boolean
  }) => ({
    toolSignature: overrides.toolSignature ?? '',
    hadToolCallError: overrides.hadToolCallError ?? false,
    isThinkOnly: overrides.isThinkOnly ?? false,
  })

  const drive = (
    steps: Array<{
      toolSignature?: string
      hadToolCallError?: boolean
      isThinkOnly?: boolean
    }>,
  ): RunawayGuardCounters => {
    let counters = initialRunawayGuardCounters()
    for (const step of steps) {
      counters = updateAndEvaluateRunawayGuards(
        counters,
        inputOf(step),
      ).counters
    }
    return counters
  }

  test('identical tool signatures accumulate and trip exactly at the limit', () => {
    let counters = initialRunawayGuardCounters()
    let trip = null as string | null
    for (let i = 0; i < REPEATED_TOOL_CALL_LIMIT; i += 1) {
      const verdict = updateAndEvaluateRunawayGuards(counters, {
        toolSignature: 'same',
        hadToolCallError: false,
        isThinkOnly: false,
      })
      counters = verdict.counters
      trip = verdict.tripReason
    }
    expect(counters.consecutiveIdenticalToolSignatures).toBe(
      REPEATED_TOOL_CALL_LIMIT,
    )
    expect(trip).toBe('repeated-tool-calls')
  })

  test('below-limit repeats do not trip', () => {
    const counters = drive([
      { toolSignature: 'same' },
      { toolSignature: 'same' },
      { toolSignature: 'same' },
    ])
    expect(counters.consecutiveIdenticalToolSignatures).toBe(3)
    const verdict = updateAndEvaluateRunawayGuards(counters, {
      toolSignature: 'same',
      hadToolCallError: false,
      isThinkOnly: false,
    })
    expect(verdict.tripReason).toBe('repeated-tool-calls')
  })

  test('a different signature resets the repeat counter', () => {
    const counters = drive([
      { toolSignature: 'a' },
      { toolSignature: 'a' },
      { toolSignature: 'a' },
      { toolSignature: 'b' },
      { toolSignature: 'b' },
    ])
    expect(counters.consecutiveIdenticalToolSignatures).toBe(2)
  })

  test('an empty signature (no tool calls) resets the repeat counter', () => {
    const counters = drive([
      { toolSignature: 'a' },
      { toolSignature: 'a' },
      {},
      { toolSignature: 'a' },
    ])
    expect(counters.consecutiveIdenticalToolSignatures).toBe(1)
  })

  test('consecutive tool-error steps accumulate and trip at the limit', () => {
    const counters = drive(
      Array.from({ length: CONSECUTIVE_TOOL_ERROR_LIMIT }, (_, i) => ({
        toolSignature: `err-${i}`,
        hadToolCallError: true,
      })),
    )
    expect(counters.consecutiveToolErrorSteps).toBe(
      CONSECUTIVE_TOOL_ERROR_LIMIT,
    )
    const verdict = updateAndEvaluateRunawayGuards(counters, {
      toolSignature: 'err-next',
      hadToolCallError: true,
      isThinkOnly: false,
    })
    expect(verdict.tripReason).toBe('consecutive-tool-errors')
  })

  test('a clean step resets the error counter', () => {
    const counters = drive([
      { toolSignature: 'e1', hadToolCallError: true },
      { toolSignature: 'e2', hadToolCallError: true },
      { toolSignature: 'ok', hadToolCallError: false },
      { toolSignature: 'e3', hadToolCallError: true },
    ])
    expect(counters.consecutiveToolErrorSteps).toBe(1)
  })

  test('think-only responses accumulate and trip at the limit', () => {
    let counters = initialRunawayGuardCounters()
    let trip = null as string | null
    for (let i = 0; i < THINK_ONLY_LIMIT; i += 1) {
      const verdict = updateAndEvaluateRunawayGuards(counters, {
        toolSignature: '',
        hadToolCallError: false,
        isThinkOnly: true,
      })
      counters = verdict.counters
      trip = verdict.tripReason
    }
    expect(counters.consecutiveThinkOnlyResponses).toBe(THINK_ONLY_LIMIT)
    expect(trip).toBe('think-only-loop')
  })

  test('a visible response resets the think counter', () => {
    const counters = drive([
      { isThinkOnly: true },
      { isThinkOnly: true },
      { isThinkOnly: false },
      { isThinkOnly: true },
    ])
    expect(counters.consecutiveThinkOnlyResponses).toBe(1)
  })

  test('repeated-tool-calls wins when multiple guards trip simultaneously', () => {
    const counters = drive([
      { toolSignature: 'dup', hadToolCallError: true },
      { toolSignature: 'dup', hadToolCallError: true },
      { toolSignature: 'dup', hadToolCallError: true },
    ])
    const verdict = updateAndEvaluateRunawayGuards(counters, {
      toolSignature: 'dup',
      hadToolCallError: true,
      isThinkOnly: true,
    })
    expect(verdict.tripReason).toBe('repeated-tool-calls')
  })

  test('buildToolCallSignature is independent of object key order', () => {
    expect(
      buildToolCallSignature([
        {
          toolName: 'read_files',
          input: { zeta: 1, alpha: [2, { y: 3, b: 4 }] },
        },
      ]),
    ).toBe(
      buildToolCallSignature([
        {
          toolName: 'read_files',
          input: { alpha: [2, { b: 4, y: 3 }], zeta: 1 },
        },
      ]),
    )
  })

  test('buildToolCallSignature distinguishes different calls', () => {
    expect(
      buildToolCallSignature([{ toolName: 'x', input: { a: 1 } }]),
    ).not.toBe(buildToolCallSignature([{ toolName: 'x', input: { a: 2 } }]))
    expect(
      buildToolCallSignature([{ toolName: 'x', input: { a: 1 } }]),
    ).not.toBe(buildToolCallSignature([{ toolName: 'y', input: { a: 1 } }]))
  })

  test('empty call list yields an empty signature', () => {
    expect(buildToolCallSignature([])).toBe('')
  })
})
