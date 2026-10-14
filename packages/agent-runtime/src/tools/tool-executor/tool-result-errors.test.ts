import { describe, expect, it } from 'bun:test'

import {
  extractToolResultError,
  hasToolResultError,
  inspectToolResultFailure,
  toolResultErrorLine,
} from './tool-result-errors'

/**
 * FID-2026-0909-005 — extractor pins + the detection/extraction mirror.
 *
 * The lifecycle wiring keeps a generic fallback label for shape drift; that
 * fallback is unreachable while the mirror below holds. The corpus
 * invariant pins the mirror for every error shape the checker knows TODAY
 * — a field added to the checker later needs a matching corpus entry (and
 * extractor branch) or the fallback silently engages for that field.
 * Lifecycle end-to-end pins live in result-lifecycle.test.ts beside their
 * subject module.
 */

describe('extractToolResultError', () => {
  it('returns "" for non-array content', () => {
    expect(extractToolResultError('plain')).toBe('')
    expect(extractToolResultError(null)).toBe('')
    expect(extractToolResultError(undefined)).toBe('')
    expect(extractToolResultError({ value: { error: 'x' } })).toBe('')
  })

  it('returns "" for empty arrays and non-error results', () => {
    expect(extractToolResultError([])).toBe('')
    expect(
      extractToolResultError([{ type: 'json', value: { result: 'ok' } }]),
    ).toBe('')
    expect(extractToolResultError([{ type: 'json', value: {} }])).toBe('')
  })

  it('skips parts without an object value', () => {
    expect(extractToolResultError([{ other: true }])).toBe('')
    expect(extractToolResultError([{ type: 'json', value: 'str' }])).toBe('')
    expect(extractToolResultError([{ type: 'json', value: ['arr'] }])).toBe('')
    expect(extractToolResultError([{ type: 'json' }])).toBe('')
  })

  it('extracts errorMessage, error, and errorCode shapes', () => {
    expect(
      extractToolResultError([
        { type: 'json', value: { errorMessage: 'boom' } },
      ]),
    ).toBe('boom')
    expect(
      extractToolResultError([{ type: 'json', value: { error: 'boom' } }]),
    ).toBe('boom')
    expect(
      extractToolResultError([
        { type: 'json', value: { errorCode: 'E_NOENT' } },
      ]),
    ).toBe('E_NOENT')
  })

  it('prefers errorMessage over error over errorCode within one part', () => {
    expect(
      extractToolResultError([
        {
          type: 'json',
          value: { error: 'second', errorCode: 'E_X', errorMessage: 'first' },
        },
      ]),
    ).toBe('first')
    expect(
      extractToolResultError([
        { type: 'json', value: { error: 'second', errorCode: 'E_X' } },
      ]),
    ).toBe('second')
  })

  it('skips empty-string error fields to the next field', () => {
    expect(
      extractToolResultError([
        { type: 'json', value: { errorMessage: '', error: 'real' } },
      ]),
    ).toBe('real')
  })

  it('lets the first error-carrying part win in array order', () => {
    expect(
      extractToolResultError([
        { type: 'json', value: { result: 'ok' } },
        { type: 'json', value: { errorMessage: 'first error' } },
        { type: 'json', value: { error: 'second error' } },
      ]),
    ).toBe('first error')
    expect(
      extractToolResultError([
        { type: 'json', value: { errorMessage: 'a' } },
        { type: 'json', value: { errorMessage: 'b' } },
      ]),
    ).toBe('a')
  })

  it('does not require a type field (mirrors the checker)', () => {
    expect(
      extractToolResultError([{ value: { errorMessage: 'no type' } }]),
    ).toBe('no type')
  })
})

describe('detection/extraction mirror invariant', () => {
  const CORPUS: unknown[] = [
    'plain string',
    null,
    undefined,
    42,
    [],
    [null],
    [undefined],
    [{ type: 'json', value: { result: 'ok' } }],
    [{ type: 'json', value: {} }],
    [{ type: 'json', value: '' }],
    [{ type: 'json', value: ['array'] }],
    [{ type: 'json', value: { errorMessage: 'a' } }],
    [{ type: 'json', value: { error: 'a' } }],
    [{ type: 'json', value: { errorCode: 'a' } }],
    [{ type: 'json', value: { errorMessage: '' } }],
    [{ type: 'json', value: { errorMessage: 7 } }],
    [{ type: 'json', value: { result: 'ok' } }, { value: { error: 'late' } }],
    [{ value: { error: 'untyped part' } }],
    [{ value: { errorMessage: 'a' } }, { value: { error: 'b' } }],
    [{ value: null }],
    [{ value: 'x' }],
  ]

  it('hasToolResultError(x) is true iff extractToolResultError(x) !== ""', () => {
    for (const shape of CORPUS) {
      expect(extractToolResultError(shape) !== '').toBe(
        hasToolResultError(shape),
      )
    }
  })
})

describe('toolResultErrorLine (lifecycle-site helper)', () => {
  it('passes the real extracted error through unchanged', () => {
    expect(
      toolResultErrorLine([
        { type: 'json', value: { errorMessage: 'HTTP 404: no results' } },
      ]),
    ).toBe('HTTP 404: no results')
  })

  it('falls back to the generic label when nothing is extractable', () => {
    expect(toolResultErrorLine([])).toBe('tool result contains an error')
    expect(toolResultErrorLine('not-array')).toBe(
      'tool result contains an error',
    )
    expect(
      toolResultErrorLine([{ type: 'json', value: { result: 'ok' } }]),
    ).toBe('tool result contains an error')
  })

  it('never emits an empty line (dedup keys need non-empty input)', () => {
    expect(toolResultErrorLine(undefined).length).toBeGreaterThan(0)
    expect(toolResultErrorLine(null).length).toBeGreaterThan(0)
  })
})

describe('inspectToolResultFailure (FID-2026-1012-023 identity transport)', () => {
  it('pairs the failing value with the identity it declares', () => {
    // The delegated-abort shape the ledger recorded as `run_readonly_command`
    // with a message naming `run_terminal_command`.
    const inspection = inspectToolResultFailure([
      {
        type: 'json',
        value: {
          errorMessage: 'Tool call aborted: run_terminal_command',
          executionOutcome: 'cancelled',
          executionStarted: false,
          executedToolName: 'run_terminal_command',
          terminationState: 'not-started',
        },
      },
    ])

    expect(inspection.failed).toBe(true)
    expect(inspection.line).toBe('Tool call aborted: run_terminal_command')
    expect(inspection.commandExecution).toMatchObject({
      executionOutcome: 'cancelled',
      executedToolName: 'run_terminal_command',
      terminationState: 'not-started',
    })
  })

  it('reads the identity of the FAILING value inside a batch, not the first one', () => {
    const inspection = inspectToolResultFailure([
      {
        type: 'json',
        value: {
          commands: ['echo ok', 'bun run typecheck'],
          results: [
            { command: 'echo ok', stdout: 'ok', exitCode: 0 },
            {
              command: 'bun run typecheck',
              errorMessage: 'Command timed out after 30 seconds.',
              executionOutcome: 'timed-out',
              executedToolName: 'run_terminal_command',
              timeoutSeconds: 30,
            },
          ],
        },
      },
    ])

    expect(inspection.line).toBe('Command timed out after 30 seconds.')
    expect(inspection.commandExecution).toMatchObject({
      executionOutcome: 'timed-out',
      executedToolName: 'run_terminal_command',
      timeoutSeconds: 30,
    })
  })

  it('omits the identity when the failing value declares none', () => {
    const inspection = inspectToolResultFailure([
      { type: 'json', value: { errorMessage: 'plain failure' } },
    ])
    expect(inspection.failed).toBe(true)
    expect(inspection.commandExecution).toBeUndefined()
  })

  it('keeps the fallback line and no identity when nothing is extractable', () => {
    const inspection = inspectToolResultFailure([{ type: 'json', value: {} }])
    expect(inspection).toEqual({ failed: false, line: toolResultErrorLine([]) })
    expect(inspectToolResultFailure('plain').failed).toBe(false)
  })

  it('agrees with hasToolResultError on the whole corpus', () => {
    for (const shape of CORPUS_SHAPES) {
      expect(inspectToolResultFailure(shape).failed).toBe(
        hasToolResultError(shape),
      )
    }
  })
})

describe('harness-declared expectedness (FID-2026-1012-024 Loop 12)', () => {
  /** The readonly guard declares a refusal on its own stderr channel. */
  const exitWithStderr = (stderr: string) => [
    { type: 'json' as const, value: { results: [{ exitCode: 1, stderr }] } },
  ]

  it('classifies the guard refusal as the expected outcome it is', () => {
    const inspection = inspectToolResultFailure(
      exitWithStderr('run_readonly_command rejected: forbidden metacharacters'),
    )
    expect(inspection.failed).toBe(true)
    expect(inspection.expectedness).toBe('expected')
    expect(inspection.line).toBe(
      'run_readonly_command rejected: forbidden metacharacters',
    )
  })

  it('leaves a real exit that merely quotes the phrase unclassified', () => {
    const inspection = inspectToolResultFailure(
      exitWithStderr('grep: run_readonly_command rejected: not found'),
    )
    expect(inspection.line).toBe(
      'Command exited with code 1: grep: run_readonly_command rejected: not found',
    )
    expect(inspection.expectedness).toBeUndefined()
  })

  it('assigns no classification to any other failure shape', () => {
    for (const shape of CORPUS_SHAPES)
      expect(inspectToolResultFailure(shape).expectedness).toBeUndefined()
  })
})

/** Mirrors the detection corpus above plus the identity-bearing shape. */
const CORPUS_SHAPES: unknown[] = [
  'plain string',
  null,
  undefined,
  [],
  [{ type: 'json', value: { result: 'ok' } }],
  [{ type: 'json', value: { errorMessage: 'a' } }],
  [{ type: 'json', value: { error: 'a' } }],
  [
    {
      type: 'json',
      value: {
        errorMessage: 'cancelled',
        executionOutcome: 'cancelled',
        executedToolName: 'run_terminal_command',
      },
    },
  ],
  [{ value: { error: 'late' } }, { value: { errorMessage: 'early' } }],
]
