// simplify-tool-results — terminal-command output simplification.
// Sibling of the Loop 327 decomposition. FID-2026-1007-004 step 3: stdout is now
// replaced only on the strength of a retention handle, and the held-back branch
// (an unprocessable result) no longer substitutes a lossy `{ command: '' }`.

import { beforeEach, describe, expect, it } from 'bun:test'

import { rememberRetention } from '../../evidence/retention-registry'
import { simplifyTerminalCommandResults } from '../simplify-tool-results'

import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'

// Mock logger for tests
const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const HANDLE_ID = 'call-term'

/** The boundary's verdict for this call — what authorises the drop. */
function grantHandle(): void {
  rememberRetention(HANDLE_ID, {
    retained: true,
    handle: {
      file: `${HANDLE_ID}.jsonl`,
      toolCallId: HANDLE_ID,
      sha256: 'c'.repeat(64),
      bytes: 1,
      redacted: false,
    },
  })
}

/** The simplified json value, read through a loose enough type to assert on. */
function valueOf(
  result: SavantCodeToolOutput<'run_terminal_command'>,
): Record<string, unknown> {
  return (result[0] as unknown as { value: Record<string, unknown> }).value
}

/** The marker that names where the omitted bytes went. */
function omissionMatcher() {
  return expect.objectContaining({
    omittedChars: expect.any(Number),
    retained: expect.objectContaining({ ok: true, toolCallId: HANDLE_ID }),
  })
}

describe('simplifyTerminalCommandResults', () => {
  beforeEach(() => {
    grantHandle()
  })

  it('should simplify terminal command results with stdout', () => {
    const input: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: {
          command: 'npm test',
          startingCwd: '/project',
          message: 'Tests completed',
          stderr: '',
          stdout: 'Test suite passed\n✓ All tests passed',
          exitCode: 0,
        },
      },
    ]

    const result = simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: HANDLE_ID,
    })

    expect(valueOf(result)).toEqual({
      command: 'npm test',
      message: 'Tests completed',
      stdoutOmittedForLength: true,
      exitCode: 0,
      omitted: omissionMatcher(),
    })
  })

  it('should simplify terminal command results without message', () => {
    const input: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: {
          command: 'ls -la',
          stdout: 'file1.txt\nfile2.txt',
          exitCode: 0,
        },
      },
    ]

    const result = simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: HANDLE_ID,
    })

    expect(valueOf(result)).toEqual({
      command: 'ls -la',
      stdoutOmittedForLength: true,
      exitCode: 0,
      omitted: omissionMatcher(),
    })
  })

  it('should simplify terminal command results without exitCode', () => {
    const input: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: {
          command: 'echo hello',
          stdout: 'hello',
        },
      },
    ]

    const result = simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: HANDLE_ID,
    })

    expect(valueOf(result)).toEqual({
      command: 'echo hello',
      stdoutOmittedForLength: true,
      omitted: omissionMatcher(),
    })
  })

  it('should handle background process results without simplification', () => {
    const input: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: {
          command: 'npm start',
          processId: 12345,
          backgroundProcessStatus: 'running' as const,
        },
      },
    ]

    const result = simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: HANDLE_ID,
    })

    expect(result).toBe(input)
  })

  it('should handle error message results without simplification', () => {
    const input: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: {
          command: 'invalid-command',
          errorMessage: 'Command not found',
        },
      },
    ]

    const result = simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: HANDLE_ID,
    })

    expect(result).toBe(input)
  })

  it('should not touch results that already have stdoutOmittedForLength', () => {
    const input: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: {
          command: 'npm test',
          message: 'Tests completed',
          stdoutOmittedForLength: true,
          exitCode: 0,
        },
      },
    ]

    const result = simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: HANDLE_ID,
    })

    expect(result).toBe(input)
  })

  it('returns a payload it cannot process untouched, instead of a lossy fallback', () => {
    // A shape the output schema cannot produce. This used to substitute
    // `{ command: '', stdoutOmittedForLength: true }`, deleting the command
    // outright — itself a silent loss.
    const input = [
      { type: 'json', value: 'raw string output' },
    ] as unknown as SavantCodeToolOutput<'run_terminal_command'>
    expect(
      simplifyTerminalCommandResults({
        messageContent: input,
        logger,
        toolCallId: HANDLE_ID,
      }),
    ).toBe(input)

    // ...and a malformed CALL is refused rather than thrown on.
    const malformed = {
      invalidStructure: true,
      logger,
    } as unknown as Parameters<typeof simplifyTerminalCommandResults>[0]
    expect(() => simplifyTerminalCommandResults(malformed)).not.toThrow()
  })

  it('should not mutate the original input', () => {
    const originalInput: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: {
          command: 'npm test',
          stdout: 'Test output',
          exitCode: 0,
        },
      },
    ]
    const input = structuredClone(originalInput)

    simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: HANDLE_ID,
    })

    // Original input should be unchanged
    expect(input).toEqual(originalInput)
  })

  it('should handle terminal command with stderr', () => {
    const input: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: {
          command: 'npm test',
          stderr: 'Warning: deprecated package',
          stdout: 'Tests passed',
          exitCode: 0,
        },
      },
    ]

    const result = simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: HANDLE_ID,
    })

    expect(valueOf(result)).toEqual({
      command: 'npm test',
      stdoutOmittedForLength: true,
      exitCode: 0,
      omitted: omissionMatcher(),
    })
  })

  it('should handle terminal command with startingCwd', () => {
    const input: SavantCodeToolOutput<'run_terminal_command'> = [
      {
        type: 'json',
        value: {
          command: 'pwd',
          startingCwd: '/home/user/project',
          stdout: '/home/user/project',
          exitCode: 0,
        },
      },
    ]

    const result = simplifyTerminalCommandResults({
      messageContent: input,
      logger,
      toolCallId: HANDLE_ID,
    })

    expect(valueOf(result)).toEqual({
      command: 'pwd',
      stdoutOmittedForLength: true,
      exitCode: 0,
      omitted: omissionMatcher(),
    })
  })
})
