import {
  ARGUMENT_BUDGET_SHARE,
  DEFAULT_OUTPUT_ALLOWANCE_TOKENS,
  MAX_ARGUMENT_CHARS,
  MIN_ARGUMENT_CHARS,
  assessToolArguments,
  describeArgumentBudget,
  measureSerializedArguments,
  toolArgumentBudget,
} from '@savant-code/common/util/tool-argument-budget'
import { expect, test } from 'bun:test'

import { refuseOversizedToolCall } from '../run/tool-call-argument-ceiling'

import type { JSONValue } from '@savant-code/common/types/json'

/**
 * FID-2026-1012-017: the emit path's per-tool argument budget. These tests pin
 * the derivation (the number must scale with the model actually in use), the
 * measurement's fail-closed behaviour, and the ceiling the runtime enforces
 * before any executor runs.
 */

/** The message of a refusal without widening the union. */
function refusalMessage(
  refused: ReturnType<typeof refuseOversizedToolCall>,
): string {
  const value = refused?.output[0]
  return value?.type === 'json' ? JSON.stringify(value.value) : ''
}

test('derives the budget from the model output allowance', () => {
  const small = toolArgumentBudget({
    toolName: 'write_file',
    maxOutputTokens: 4_096,
  })
  const large = toolArgumentBudget({
    toolName: 'write_file',
    maxOutputTokens: 16_384,
  })

  expect(small.maxArgumentChars).toBe(
    Math.floor(4_096 * 4 * ARGUMENT_BUDGET_SHARE),
  )
  expect(large.maxArgumentChars).toBe(
    Math.floor(16_384 * 4 * ARGUMENT_BUDGET_SHARE),
  )
  expect(large.maxArgumentChars).toBeGreaterThan(small.maxArgumentChars)
  expect(small.outputAllowanceTokens).toBe(4_096)
})

test('falls back to the default allowance for absent or hostile values', () => {
  const budget = toolArgumentBudget({ toolName: 'write_file' })

  expect(budget.outputAllowanceTokens).toBe(DEFAULT_OUTPUT_ALLOWANCE_TOKENS)
  expect(
    toolArgumentBudget({ toolName: 'write_file', maxOutputTokens: 0 })
      .outputAllowanceTokens,
  ).toBe(DEFAULT_OUTPUT_ALLOWANCE_TOKENS)
  expect(
    toolArgumentBudget({ toolName: 'write_file', maxOutputTokens: -1 })
      .outputAllowanceTokens,
  ).toBe(DEFAULT_OUTPUT_ALLOWANCE_TOKENS)
  expect(
    toolArgumentBudget({ toolName: 'write_file', maxOutputTokens: Number.NaN })
      .outputAllowanceTokens,
  ).toBe(DEFAULT_OUTPUT_ALLOWANCE_TOKENS)
})

test('gives structurally short tools a tighter share than bulk tools', () => {
  const bulk = toolArgumentBudget({
    toolName: 'write_file',
    maxOutputTokens: 16_384,
  })
  const short = toolArgumentBudget({
    toolName: 'write_todos',
    maxOutputTokens: 16_384,
  })

  expect(bulk.maxArgumentChars).toBe(
    Math.floor(16_384 * 4 * ARGUMENT_BUDGET_SHARE),
  )
  expect(short.maxArgumentChars).toBe(Math.floor(16_384 * 4 * 0.25))
  expect(short.maxArgumentChars).toBeLessThan(bulk.maxArgumentChars)
  expect(
    toolArgumentBudget({ toolName: 'write_todos', maxOutputTokens: 1_024 })
      .maxArgumentChars,
  ).toBe(MIN_ARGUMENT_CHARS)
})

test('clamps the budget to the floor and the ceiling', () => {
  expect(
    toolArgumentBudget({ toolName: 'write_file', maxOutputTokens: 1 })
      .maxArgumentChars,
  ).toBe(MIN_ARGUMENT_CHARS)
  expect(
    toolArgumentBudget({ toolName: 'write_file', maxOutputTokens: 1_000_000 })
      .maxArgumentChars,
  ).toBe(MAX_ARGUMENT_CHARS)
})

test('measures the serialized arguments, not the value', () => {
  const input: JSONValue = { path: 'a.ts', content: 'hello' }

  expect(measureSerializedArguments(input)).toBe(JSON.stringify(input).length)
  expect(measureSerializedArguments(null)).toBe('null'.length)
})

test('fails closed when the arguments cannot be serialized', () => {
  const cyclic: Record<string, JSONValue> = { name: 'cyclic' }
  cyclic.self = cyclic

  expect(measureSerializedArguments(cyclic)).toBe(Number.POSITIVE_INFINITY)
})

test('assesses a call against its tool budget', () => {
  const within = assessToolArguments({
    toolName: 'write_file',
    arguments: { content: 'x'.repeat(100) },
    maxOutputTokens: 8_192,
  })
  const over = assessToolArguments({
    toolName: 'write_todos',
    arguments: { todos: ['y'.repeat(9_000)] },
    maxOutputTokens: 8_192,
  })

  expect(within.withinBudget).toBe(true)
  expect(over.withinBudget).toBe(false)
  expect(over.serializedChars).toBeGreaterThan(over.maxArgumentChars)
})

test('states the budget in one sentence for the recovery text', () => {
  const description = describeArgumentBudget(
    toolArgumentBudget({ toolName: 'write_file', maxOutputTokens: 8_192 }),
  )

  expect(description).toContain('16384 characters')
  expect(description).toContain('8192-token output allowance')
})

test('allows a complete payload below the ceiling', () => {
  const refused = refuseOversizedToolCall({
    toolName: 'write_file',
    input: { path: 'big.ts', content: 'x'.repeat(MAX_ARGUMENT_CHARS - 100) },
  })

  expect(refused).toBeNull()
})

test('refuses a payload above the ceiling before anything executes', () => {
  const refused = refuseOversizedToolCall({
    toolName: 'write_file',
    input: { path: 'huge.ts', content: 'x'.repeat(MAX_ARGUMENT_CHARS + 1) },
  })

  expect(refused).not.toBeNull()
  const message = refusalMessage(refused)
  expect(message).toContain('nothing was executed')
  expect(message).toContain(String(MAX_ARGUMENT_CHARS))
  expect(message).toContain('append the rest with str_replace')
})

test('refuses a payload that cannot be serialized at all', () => {
  const cyclic: Record<string, JSONValue> = { path: 'huge.ts' }
  cyclic.self = cyclic

  const refused = refuseOversizedToolCall({
    toolName: 'write_file',
    input: cyclic,
  })

  expect(refused).not.toBeNull()
})
