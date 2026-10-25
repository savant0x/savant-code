import { describe, expect, test } from 'bun:test'

import {
  extractToolResultError,
  hasCommandFailure,
  hasToolResultError,
  inspectToolResultFailure,
  TOOL_RESULT_ERROR_FALLBACK,
} from './tool-result-errors'
import { inspectToolOutputFailures } from './tool-result-inspection'

import type { ExperienceExpectedness } from '@savant-code/common/types/experience'
import type { JSONValue } from '@savant-code/common/types/json'

describe('FID-2026-1012-024 producer-shaped failure coverage', () => {
  // Restated independently of the walker: the declared shared node budget is
  // part of FID-2026-1012-024's contract, so the control asserts the number and
  // does not borrow the implementation's own constant.
  const DECLARED_NODE_BUDGET = 4_096
  // FID-2026-1024-001: expectedness comes from producer-owned evidence in the
  // walker — the harness's own refusal channel (D3), the executed program's
  // non-zero exit (D2), the filesystem's answered read statuses (D2) and a
  // declared, enforced timeout budget (D4). Everything the harness itself
  // decided or failed to record stays unclassified.
  const failures: Array<{
    name: string
    value: JSONValue
    error: string
    expectedness?: ExperienceExpectedness
  }> = [
    {
      name: 'terminal command exit',
      value: {
        command: 'fixture',
        stdout: '',
        stderr: 'compile failed',
        exitCode: 1,
      },
      error: 'Command exited with code 1: compile failed',
      expectedness: 'expected',
    },
    {
      name: 'command exit carrying producer metadata',
      value: {
        command: 'fixture',
        stdout: '',
        stderr: 'build failed',
        exitCode: 2,
        executionOutcome: 'completed',
        executionStarted: true,
        executedToolName: 'run_terminal_command',
      },
      error: 'Command exited with code 2: build failed',
      expectedness: 'expected',
    },
    {
      name: 'declared and enforced timeout budget',
      value: {
        errorMessage: 'Command timed out after 3600 seconds.',
        executionOutcome: 'timed-out',
        executionStarted: true,
        executedToolName: 'run_terminal_command',
        terminationState: 'requested',
        timeoutSeconds: 3600,
      },
      error: 'Command timed out after 3600 seconds.',
      expectedness: 'expected',
    },
    {
      name: 'timeout whose termination cannot be requested',
      value: {
        errorMessage: 'Command timed out after 30 seconds.',
        executionOutcome: 'timed-out',
        executionStarted: true,
        executedToolName: 'run_terminal_command',
        terminationState: 'unavailable',
        timeoutSeconds: 30,
      },
      error: 'Command timed out after 30 seconds.',
    },
    {
      name: 'timeout without a declared budget',
      value: {
        errorMessage: 'Command timed out after 30 seconds.',
        executionOutcome: 'timed-out',
        executedToolName: 'run_terminal_command',
      },
      error: 'Command timed out after 30 seconds.',
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
      expectedness: 'expected',
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
      expectedness: 'expected',
    },
    {
      name: 'file read status',
      value: [{ path: 'missing.ts', content: '[FILE_DOES_NOT_EXIST]' }],
      error: 'File read did not complete: [FILE_DOES_NOT_EXIST]',
      expectedness: 'expected',
    },
    {
      name: 'file read outside the project',
      value: [{ path: 'a.ts', content: '[FILE_OUTSIDE_PROJECT]' }],
      error: 'File read did not complete: [FILE_OUTSIDE_PROJECT]',
      expectedness: 'expected',
    },
    {
      name: 'file read truncation',
      value: [
        { path: 'large.ts', content: 'head\n\n[FILE_TOO_LARGE: truncated]' },
      ],
      error: 'File read did not complete: [FILE_TOO_LARGE]',
      expectedness: 'expected',
    },
    {
      name: 'the read policy refusal stays a harness decision',
      value: [{ path: '.env', content: '[BLOCKED]' }],
      error: 'File read did not complete: [BLOCKED]',
    },
    {
      name: 'a read IO error stays a harness decision',
      value: [{ path: 'locked.ts', content: '[FILE_READ_ERROR]' }],
      error: 'File read did not complete: [FILE_READ_ERROR]',
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
      name: 'readonly guard refusal (its own channel, not an exit)',
      value: {
        executionOutcome: 'rejected',
        executionStarted: false,
        executedToolName: 'run_readonly_command',
        terminationState: 'not-started',
        rejectionReason: 'readonly-guard',
        command: 'cat a | tee b',
        stdout: '',
        stderr:
          'run_readonly_command rejected: Command contains forbidden shell metacharacters',
        exitCode: 1,
      },
      error:
        'run_readonly_command rejected: Command contains forbidden shell metacharacters',
      expectedness: 'expected',
    },
    {
      name: 'real non-zero exit is still reported as an exit',
      value: {
        command: 'cat missing',
        stdout: '',
        stderr: 'cat: missing: No such file or directory',
        exitCode: 1,
      },
      error:
        'Command exited with code 1: cat: missing: No such file or directory',
      expectedness: 'expected',
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
      // Only the harness's own unrecorded decisions stay unclassified: the
      // guard refusal, the target's non-zero exit, the filesystem's answered
      // statuses and a declared-enforced timeout all produce evidence the
      // walker reads.
      expect(inspectToolResultFailure(output).expectedness).toBe(
        fixture.expectedness,
      )
    })
  }

  test('a real exit that merely quotes the refusal phrase is still an exit', () => {
    // Refusal authority comes from producer metadata, so quoted stderr alone
    // cannot promote a normal command into a validation refusal.
    const output = [
      {
        value: {
          command: 'grep -r "run_readonly_command rejected: " .',
          stdout: '',
          stderr: './a.ts: run_readonly_command rejected: x',
          exitCode: 1,
        },
      },
    ]
    expect(extractToolResultError(output)).toBe(
      'Command exited with code 1: ./a.ts: run_readonly_command rejected: x',
    )
    // FID-2026-1024-001 D2: the exit is the program's answer — expected — but
    // it is NOT a guard refusal: the refusal cause stays additive, so a quoted
    // phrase never promotes a real exit into the validation channel.
    expect(inspectToolResultFailure(output).expectedness).toBe('expected')
    expect(
      inspectToolOutputFailures(output)[0]?.error.startsWith('Command exited'),
    ).toBe(true)
  })

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
    // Every inspected part costs at least one node of the shared budget, so an
    // envelope wider than the budget cannot be walked to the end.
    let inspectedParts = 0
    const parts = Array.from({ length: 5_000 }, () => ({
      get value() {
        inspectedParts += 1
        return { exitCode: 0 }
      },
    }))
    expect(extractToolResultError(parts)).toContain('inspection')
    expect(inspectedParts).toBeGreaterThan(0)
    expect(inspectedParts).toBeLessThanOrEqual(DECLARED_NODE_BUDGET)
  })

  test('nested inspection stops visiting values when the shared budget ends', () => {
    // Count distinct values, never property reads: scalarFailure reads a numeric
    // `exitCode` twice per value (`typeof` then the comparison), so a raw read
    // counter reports roughly twice the traversal and cannot be compared with a
    // node budget.
    const visited = new Set<number>()
    const values = Array.from({ length: 10_000 }, (_value, index) => ({
      get exitCode() {
        visited.add(index)
        return 0
      },
    }))
    // The visited-count assertion alone cannot see a boundary error that reads
    // one element too many, so every index at or beyond the budget is a trap: a
    // traversal that reads past its cap is recorded instead of passing silently.
    const readPastBudget: number[] = []
    for (const index of [
      DECLARED_NODE_BUDGET,
      DECLARED_NODE_BUDGET + 1,
      5_000,
      9_999,
    ]) {
      Object.defineProperty(values, index, {
        get() {
          readPastBudget.push(index)
          return 0
        },
      })
    }
    const failures = inspectToolOutputFailures([{ value: { results: values } }])
    expect(readPastBudget).toEqual([])
    expect(visited.size).toBeGreaterThan(0)
    expect(visited.size).toBeLessThanOrEqual(DECLARED_NODE_BUDGET)
    expect(failures).toHaveLength(1)
    expect(failures[0]?.error).toContain('inspection')
  })

  test('an outer refusal cannot hide a nested executed failure', () => {
    const failures = inspectToolOutputFailures([
      {
        value: {
          executionOutcome: 'rejected',
          rejectionReason: 'readonly-guard',
          errorMessage: 'outer refusal',
          results: [{ exitCode: 2, stderr: 'nested host failure' }],
        },
      },
    ])
    expect(failures).toHaveLength(2)
    expect(failures[0]?.expectedness).toBe('expected')
    expect(failures[1]?.error).toContain('nested host failure')
    // FID-2026-1024-001 D2: the nested executed program answered — expected —
    // while the outer refusal is the harness's own decision, also expected on
    // both rendering paths (D3). Neither outranks the other.
    expect(failures[1]?.expectedness).toBe('expected')
  })
})
