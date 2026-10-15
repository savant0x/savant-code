import { describe, expect, it } from 'bun:test'

import { sanitizeYieldToolCallInput } from '../sanitize-yield-input'

describe('sanitizeYieldToolCallInput (FID-2026-0823-009)', () => {
  it('drops explicit undefined-valued keys from tool-call input', () => {
    const yielded = {
      toolName: 'code_search',
      input: {
        pattern: 'checkRecorderOutcome',
        flags: '-n',
        cwd: undefined,
        maxResults: undefined,
      },
    }
    const result = sanitizeYieldToolCallInput(yielded) as typeof yielded
    expect(Object.keys(result.input).sort()).toEqual(['flags', 'pattern'])
  })

  it('preserves null values (null is valid JSON)', () => {
    const yielded = {
      toolName: 'code_search',
      input: { pattern: 'x', cwd: null },
    }
    const result = sanitizeYieldToolCallInput(yielded) as typeof yielded
    expect(result.input.cwd).toBeNull()
  })

  it('returns the SAME reference when no undefined keys exist', () => {
    const yielded = {
      toolName: 'run_terminal_command',
      input: { command: 'echo hi' },
    }
    expect(sanitizeYieldToolCallInput(yielded)).toBe(yielded)
  })

  it('passes STEP sentinels through untouched', () => {
    expect(sanitizeYieldToolCallInput('STEP')).toBe('STEP')
    expect(sanitizeYieldToolCallInput('STEP_ALL')).toBe('STEP_ALL')
  })

  it('passes non-tool objects through untouched', () => {
    const stepText = { type: 'STEP_TEXT', text: 'hi' }
    expect(sanitizeYieldToolCallInput(stepText)).toBe(stepText)
  })

  it('tolerates tool calls whose input is missing, null, or an array', () => {
    const noInput = { toolName: 'end_turn' }
    expect(sanitizeYieldToolCallInput(noInput)).toBe(noInput)
    const nullInput = { toolName: 'x', input: null }
    expect(sanitizeYieldToolCallInput(nullInput)).toBe(nullInput)
    const arrInput = { toolName: 'x', input: [1, 2] }
    expect(sanitizeYieldToolCallInput(arrInput)).toBe(arrInput)
  })
})
