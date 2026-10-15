/**
 * FID-2026-0927-003 F1 — Law 3 verification credit must be outcome-aware.
 *
 * RED-first. The defect: `commandSucceeded` was computed as
 * `!hasToolResultError(content)`, and `hasToolResultError` recognises only
 * STRUCTURED fields (errorMessage / error / errorCode). A failing `bun test`
 * emits a `json` content part carrying `exitCode: 1` plus PLAIN TEXT, with no
 * structured error field — so the old predicate returned false and Law 3
 * credited the failure as a pass.
 *
 * The exit code is already in the payload (see
 * `handlers/tool/run-readonly-command.ts`, which emits
 * `{ type: 'json', value: { command, stdout, stderr, exitCode } }`). It was
 * simply never read. These legs pin the outcome-aware contract.
 */
import { describe, expect, it } from 'bun:test'

import { hasCommandFailure, hasToolResultError } from './tool-result-errors'
import { EchoEnforcement } from '../../echo/enforcement'

/** The real shape a failing `bun test` produces (no structured error field). */
const redTestRun = [
  {
    type: 'json',
    value: {
      command: 'bun test src/tick.test.ts',
      stdout: ' 1 fail\n 0 pass\n(fail) tick > works [3.00ms]',
      stderr: '',
      exitCode: 1,
    },
  },
]

const greenTestRun = [
  {
    type: 'json',
    value: {
      command: 'bun test src/tick.test.ts',
      stdout: ' 1 pass\n 0 fail',
      stderr: '',
      exitCode: 0,
    },
  },
]

describe('hasCommandFailure — outcome-aware command failure detection', () => {
  it('treats a non-zero exit as a FAILURE even with no structured error field', () => {
    // The F1 leg. The old shape-aware predicate returned false here, which
    // granted Law 3 credit for a red suite.
    expect(hasCommandFailure(redTestRun)).toBe(true)
  })

  it('treats exit 0 as success', () => {
    expect(hasCommandFailure(greenTestRun)).toBe(false)
  })

  it('treats a batch with ANY non-zero exit as a failure', () => {
    // run_readonly_command batches nest the per-command results.
    const batch = [
      {
        type: 'json',
        value: {
          commands: ['bun run typecheck', 'bun test'],
          results: [
            { command: 'bun run typecheck', exitCode: 0 },
            { command: 'bun test', exitCode: 2 },
          ],
        },
      },
    ]
    expect(hasCommandFailure(batch)).toBe(true)
  })

  it('treats a fully green batch as success', () => {
    const batch = [
      {
        type: 'json',
        value: {
          commands: ['bun run typecheck', 'bun test'],
          results: [
            { command: 'bun run typecheck', exitCode: 0 },
            { command: 'bun test', exitCode: 0 },
          ],
        },
      },
    ]
    expect(hasCommandFailure(batch)).toBe(false)
  })

  it('still detects a structured error when no exit code is present', () => {
    // The infrastructure-error path must not regress: a rejected command has
    // no exitCode, only an error field.
    expect(
      hasCommandFailure([
        { type: 'json', value: { error: 'command rejected' } },
      ]),
    ).toBe(true)
  })

  it('reports no failure for content carrying neither signal', () => {
    // A non-command tool result: no exitCode, no error. Must not be
    // misreported as a failed command, or every non-command tool would look red.
    expect(hasCommandFailure([{ type: 'json', value: { ok: true } }])).toBe(
      false,
    )
  })

  it('handles empty and non-array content without throwing', () => {
    expect(hasCommandFailure(undefined)).toBe(false)
    expect(hasCommandFailure([])).toBe(false)
    expect(hasCommandFailure('plain string')).toBe(false)
  })
})

describe('FID-2026-1012-024 — capture and verification agree on command outcome', () => {
  it('capture also sees a failing command without a structured error field', () => {
    // The earlier contrast preserved a capture blind spot. File-write credit
    // still requires a written path; command failure never gains that credit.
    expect(hasToolResultError(redTestRun)).toBe(true)
  })

  it('the NEW outcome-aware predicate does see it', () => {
    expect(hasCommandFailure(redTestRun)).toBe(true)
  })
})

describe('FID-2026-0927-003 F1 — end-to-end Law 3 credit through the enforcement layer', () => {
  function primed(): EchoEnforcement {
    const enforcement = new EchoEnforcement('hybrid')
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    return enforcement
  }

  function creditAfterVerification(
    content: unknown,
    commandSucceeded: boolean,
  ): boolean {
    const enforcement = primed()
    const path = '/proj/src/tick.test.ts'
    enforcement.afterToolCall({
      toolName: 'write_file',
      input: { path },
      result: { text: 'ok' },
      writeSucceeded: true,
    })
    enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun test src/tick.test.ts' },
      // The executor derives this from the tool result content; the red-run
      // shape resolves to `false` under the new predicate.
      result: { text: ' 1 fail\n 0 pass' },
      commandSucceeded,
    })
    return enforcement.getState().verifiedFiles.has(path)
  }

  it('does NOT credit a red test run — the file stays unverified and re-editable only after a green run', () => {
    // The contract that matters. Before the fix this returned TRUE.
    const credited = creditAfterVerification(
      redTestRun,
      !hasCommandFailure(redTestRun),
    )
    expect(credited).toBe(false)
  })

  it('DOES credit a green test run (no regression of the passing path)', () => {
    const credited = creditAfterVerification(
      greenTestRun,
      !hasCommandFailure(greenTestRun),
    )
    expect(credited).toBe(true)
  })
})
