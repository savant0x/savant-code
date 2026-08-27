import type { JSONValue } from '@savant-code/common/types/json'

/**
 * FID-2026-0822-002: mechanical anti-runaway guards for the agent step loop.
 *
 * The only pre-existing backstop against a turn that never terminates was
 * MAX_AGENT_STEPS_DEFAULT (200 LLM steps) — potentially hours of provider
 * spend before it fires. These guards detect the three known non-progress
 * patterns and end the turn deterministically instead:
 *
 *  1. repeated-tool-calls — the SAME tool name + arguments executed
 *     REPEATED_TOOL_CALL_LIMIT times consecutively (retry loops).
 *  2. consecutive-tool-errors — CONSECUTIVE_TOOL_ERROR_LIMIT steps in a row
 *     whose tool calls errored (each error forces a retry step).
 *  3. think-only-loop — THINK_ONLY_LIMIT responses in a row classified as
 *     <think> scaffolding with no visible answer.
 *
 * Pure decision module: counters in → counters + verdict out. No I/O —
 * trivially unit-testable without fixtures (AGENTS.md: DI over mocking).
 */

export const REPEATED_TOOL_CALL_LIMIT = 4
export const CONSECUTIVE_TOOL_ERROR_LIMIT = 5
export const THINK_ONLY_LIMIT = 3

export type RunawayGuardCounters = {
  lastToolCallSignature?: string
  consecutiveIdenticalToolSignatures: number
  consecutiveToolErrorSteps: number
  consecutiveThinkOnlyResponses: number
}

export type RunawayGuardInputs = {
  toolSignature: string
  hadToolCallError: boolean
  isThinkOnly: boolean
}

export type RunawayGuardTripReason =
  'repeated-tool-calls' | 'consecutive-tool-errors' | 'think-only-loop'

export type RunawayGuardVerdict = {
  counters: RunawayGuardCounters
  tripReason: RunawayGuardTripReason | null
}

export function initialRunawayGuardCounters(): RunawayGuardCounters {
  return {
    consecutiveIdenticalToolSignatures: 0,
    consecutiveToolErrorSteps: 0,
    consecutiveThinkOnlyResponses: 0,
  }
}

export function updateAndEvaluateRunawayGuards(
  prev: RunawayGuardCounters,
  inputs: RunawayGuardInputs,
): RunawayGuardVerdict {
  const counters: RunawayGuardCounters = { ...prev }

  if (inputs.toolSignature !== '') {
    if (counters.lastToolCallSignature === inputs.toolSignature) {
      counters.consecutiveIdenticalToolSignatures += 1
    } else {
      counters.lastToolCallSignature = inputs.toolSignature
      counters.consecutiveIdenticalToolSignatures = 1
    }
  } else {
    counters.lastToolCallSignature = undefined
    counters.consecutiveIdenticalToolSignatures = 0
  }

  counters.consecutiveToolErrorSteps = inputs.hadToolCallError
    ? counters.consecutiveToolErrorSteps + 1
    : 0

  counters.consecutiveThinkOnlyResponses = inputs.isThinkOnly
    ? counters.consecutiveThinkOnlyResponses + 1
    : 0

  let tripReason: RunawayGuardTripReason | null = null
  if (counters.consecutiveIdenticalToolSignatures >= REPEATED_TOOL_CALL_LIMIT) {
    tripReason = 'repeated-tool-calls'
  } else if (
    counters.consecutiveToolErrorSteps >= CONSECUTIVE_TOOL_ERROR_LIMIT
  ) {
    tripReason = 'consecutive-tool-errors'
  } else if (counters.consecutiveThinkOnlyResponses >= THINK_ONLY_LIMIT) {
    tripReason = 'think-only-loop'
  }

  return { counters, tripReason }
}

/**
 * Stable per-step fingerprint of executed tool calls (name + arguments).
 * Object keys are sorted at every nesting level so semantically identical
 * calls hash identically regardless of model-emitted key order.
 */
export function buildToolCallSignature(
  toolCalls: ReadonlyArray<{ toolName: string; input?: JSONValue }>,
): string {
  if (toolCalls.length === 0) return ''
  return toolCalls
    .map((call) => `${call.toolName}:${stableStringify(call.input)}`)
    .join('|')
}

function stableStringify(value: JSONValue | undefined): string {
  if (value === undefined) return ''
  return JSON.stringify(value, (_key: string, val: unknown) => {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const record = val as Record<string, unknown>
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((k) => [k, record[k]]),
      )
    }
    return val
  })
}
