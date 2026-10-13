import { describe, expect, test } from 'bun:test'

import {
  extractToolResultError,
  hasCommandFailure,
  hasToolResultError,
} from './tool-result-errors'

import type { JSONValue } from '@savant-code/common/types/json'

describe('FID-2026-1012-024 producer-shaped failure coverage', () => {
  const failures: Array<{ name: string; value: JSONValue; error: string }> = [
    {
      name: 'terminal command exit',
      value: {
        command: 'fixture',
        stdout: '',
        stderr: 'compile failed',
        exitCode: 1,
      },
      error: 'Command exited with code 1: compile failed',
    },
    {
      name: 'skill management exit',
      value: {
        action: 'patch',
        stdout: '',
        stderr: 'skill missing',
        exitCode: 1,
      },
      error: 'Command exited with code 1: skill missing',
    },
    {
      name: 'readonly batch delegated error',
      value: { results: [{ errorMessage: 'delegate failed' }] },
      error: 'delegate failed',
    },
    {
      name: 'readonly batch nonzero exit',
      value: { results: [{ exitCode: 2, stderr: 'bad command' }] },
      error: 'Command exited with code 2: bad command',
    },
    {
      name: 'file read status',
      value: [{ path: 'missing.ts', content: '[FILE_DOES_NOT_EXIST]' }],
      error: 'File read did not complete: [FILE_DOES_NOT_EXIST]',
    },
    {
      name: 'file read truncation',
      value: [
        { path: 'large.ts', content: 'head\n\n[FILE_TOO_LARGE: truncated]' },
      ],
      error: 'File read did not complete: [FILE_TOO_LARGE]',
    },
  ]

  for (const fixture of failures) {
    test(fixture.name, () => {
      const output = [{ type: 'json', value: fixture.value }]
      expect(hasToolResultError(output)).toBe(true)
      expect(hasCommandFailure(output)).toBe(true)
      expect(extractToolResultError(output)).toBe(fixture.error)
    })
  }

  test('stderr without a failing exit is not a failed command', () => {
    const output = [{ value: { stderr: 'warning', exitCode: 0 } }]
    expect(hasToolResultError(output)).toBe(false)
  })

  test('arbitrary user data is not traversed as result envelopes', () => {
    const output = [{ value: { data: { errorMessage: 'quoted source code' } } }]
    expect(hasToolResultError(output)).toBe(false)
  })

  test('cyclic result arrays fail visibly instead of hanging', () => {
    const value: { results: object[] } = { results: [] }
    value.results.push(value)
    expect(extractToolResultError([{ value }])).toContain('inspection')
  })

  test('shared successful values are not mistaken for cycles', () => {
    const success = { exitCode: 0 }
    expect(
      hasToolResultError([{ value: { results: [success, success] } }]),
    ).toBe(false)
  })
  test('a hostile outer result accessor cannot abort capture', () => {
    const part = {
      get value(): string {
        throw new Error('hostile accessor')
      },
    }
    expect(extractToolResultError([part])).toContain('inspection')
  })
  test('inspection bounds primitive array entries too', () => {
    expect(
      extractToolResultError([{ value: { results: Array(5000).fill(null) } }]),
    ).toContain('inspection')
  })
  test('the budget applies to the whole result envelope', () => {
    expect(
      extractToolResultError(
        Array.from({ length: 5000 }, () => ({ value: { exitCode: 0 } })),
      ),
    ).toContain('inspection')
  })
})
