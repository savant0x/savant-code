import { abortForUserCancellation } from '@savant-code/common/util/command-execution'
import { describe, expect, it } from 'bun:test'

import {
  inspectToolResultFailure,
  resolveToolFailureExpectedness,
} from './tool-result-errors'

/** The readonly producer carries this marker; stderr text alone is insufficient. */
const exitWithStderr = (stderr: string, harnessRefusal = false) => [
  {
    type: 'json' as const,
    value: {
      results: [
        {
          exitCode: 1,
          stderr,
          ...(harnessRefusal
            ? {
                executionOutcome: 'rejected' as const,
                executionStarted: false,
                executedToolName: 'run_readonly_command',
                terminationState: 'not-started' as const,
                rejectionReason: 'readonly-guard' as const,
              }
            : {}),
        },
      ],
    },
  },
]

describe('producer-authoritative expectedness (FID-2026-1012-024, FID-2026-1024-001)', () => {
  it('classifies the guard refusal as expected', () => {
    const inspection = inspectToolResultFailure(
      exitWithStderr(
        'run_readonly_command rejected: forbidden metacharacters',
        true,
      ),
    )
    expect(inspection.failed).toBe(true)
    expect(inspection.expectedness).toBe('expected')
    expect(inspection.line).toBe(
      'run_readonly_command rejected: forbidden metacharacters',
    )
  })

  it('does not classify matching command text as a guard refusal', () => {
    // FID-2026-1024-001 D2/D3: matching TEXT cannot promote a real exit into
    // the refusal channel (the line below keeps its command-exit rendering),
    // but the executed program's non-zero exit is itself expected.
    const inspection = inspectToolResultFailure(
      exitWithStderr('run_readonly_command rejected: command output'),
    )
    expect(inspection.expectedness).toBe('expected')
    expect(inspection.line.startsWith('Command exited')).toBe(true)
  })

  it('keeps a quoted refusal phrase as a normal host exit', () => {
    const inspection = inspectToolResultFailure(
      exitWithStderr('grep: run_readonly_command rejected: not found'),
    )
    expect(inspection.line).toBe(
      'Command exited with code 1: grep: run_readonly_command rejected: not found',
    )
    // D2: the program answered; the refusal CAUSE is established by producer
    // metadata, never by the phrase alone.
    expect(inspection.expectedness).toBe('expected')
  })

  it('classifies a declared, enforced timeout as expected (D4)', () => {
    expect(
      resolveToolFailureExpectedness({
        commandExecution: {
          executionOutcome: 'timed-out',
          executionStarted: true,
          executedToolName: 'run_terminal_command',
          terminationState: 'requested',
          timeoutSeconds: 1800,
        },
      }),
    ).toBe('expected')
  })

  it('stays unclassified for a timeout without a declared budget (D4)', () => {
    expect(
      resolveToolFailureExpectedness({
        commandExecution: { executionOutcome: 'timed-out' },
      }),
    ).toBeUndefined()
  })

  it('does not excuse a typed signal paired with a timeout', () => {
    const controller = new AbortController()
    abortForUserCancellation(controller)
    expect(
      resolveToolFailureExpectedness({
        signal: controller.signal,
        commandExecution: {
          executionOutcome: 'timed-out',
          cancellationReason: 'user-request',
        },
      }),
    ).toBeUndefined()
  })
})
