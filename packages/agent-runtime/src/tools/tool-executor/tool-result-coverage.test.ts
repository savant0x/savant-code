import { describe, expect, test } from 'bun:test'

import {
  extractToolResultError,
  hasCommandFailure,
  hasToolResultError,
  TOOL_RESULT_ERROR_FALLBACK,
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
    // FID-2026-1012-024: the flat channels are the most common production
    // shape (str_replace, write_file, spawn_agents, web_search, read_docs all
    // return a bare {errorMessage} or {error} as the part value). Covered here
    // so a future walker rewrite cannot silently drop them to the constant.
    {
      name: 'flat errorMessage (str_replace path rejection)',
      value: { errorMessage: 'str_replace: path rejected: read-only' },
      error: 'str_replace: path rejected: read-only',
    },
    {
      name: 'flat errorMessage (write_file path rejection)',
      value: { errorMessage: 'write_file: path rejected: read-only' },
      error: 'write_file: path rejected: read-only',
    },
    {
      name: 'flat legacy error channel',
      value: { error: 'legacy flat error channel' },
      error: 'legacy flat error channel',
    },
    {
      name: 'flat error code',
      value: { errorCode: 'EACCES' },
      error: 'EACCES',
    },
    {
      name: 'readonly guard rejection (live command-exit class)',
      value: {
        command: 'cat a | tee b',
        stdout: '',
        stderr:
          'run_readonly_command rejected: Command contains forbidden shell metacharacters',
        exitCode: 1,
      },
      error:
        'Command exited with code 1: run_readonly_command rejected: Command contains forbidden shell metacharacters',
    },
  ]

  for (const fixture of failures) {
    test(fixture.name, () => {
      const output = [{ type: 'json', value: fixture.value }]
      expect(hasToolResultError(output)).toBe(true)
      expect(hasCommandFailure(output)).toBe(true)
      expect(extractToolResultError(output)).toBe(fixture.error)
      // The constant is a signal, never a label: no recognised failure may
      // render as 'tool result contains an error'.
      expect(extractToolResultError(output)).not.toBe(
        TOOL_RESULT_ERROR_FALLBACK,
      )
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
