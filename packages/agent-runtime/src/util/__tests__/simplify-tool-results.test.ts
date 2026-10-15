// simplify-tool-results — read-files output simplification.
// Parent of the Loop 327 decomposition (terminal-command, truncation, and
// verbose-pre-pass suites live in sibling files). FID-2026-1007-004 step 3: the
// dropped content is replaced by a marker that names where it went, and the drop
// itself needs a retention handle.

import { beforeEach, describe, expect, it } from 'bun:test'

import { rememberRetention } from '../../evidence/retention-registry'
import { simplifyReadFileResults } from '../simplify-tool-results'

import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'

const HANDLE_ID = 'call-read'

function grantHandle(): void {
  rememberRetention(HANDLE_ID, {
    retained: true,
    handle: {
      file: `${HANDLE_ID}.jsonl`,
      toolCallId: HANDLE_ID,
      sha256: 'd'.repeat(64),
      bytes: 1,
      redacted: false,
    },
  })
}

function markerOf(
  result: SavantCodeToolOutput<'read_files'>,
  index: number,
): Record<string, unknown> {
  const file = result[0].value[index] as unknown as Record<string, unknown>
  return file.omitted as Record<string, unknown>
}

describe('simplifyReadFileResults', () => {
  beforeEach(() => {
    grantHandle()
  })

  it('should simplify read file results by omitting content', () => {
    const input: SavantCodeToolOutput<'read_files'> = [
      {
        type: 'json',
        value: [
          {
            path: 'src/file1.ts',
            content: 'const x = 1;\nconsole.log(x);',
            referencedBy: { 'file2.ts': ['line 5'] },
          },
          {
            path: 'src/file2.ts',
            content:
              'import { x } from "./file1";\nfunction test() { return x; }',
          },
        ],
      },
    ]

    const result = simplifyReadFileResults({
      messageContent: input,
      toolCallId: HANDLE_ID,
    })

    expect(result[0].value).toHaveLength(2)
    expect(result[0].value[0]).toMatchObject({
      path: 'src/file1.ts',
      contentOmittedForLength: true,
    })
    expect(result[0].value[1]).toMatchObject({
      path: 'src/file2.ts',
      contentOmittedForLength: true,
    })
    expect(result[0].value[0]).not.toHaveProperty('content')
    // The marker names the store AND carries a bounded preview of what was taken.
    expect(markerOf(result, 0).omittedChars).toBe(
      'const x = 1;\nconsole.log(x);'.length,
    )
    expect(markerOf(result, 0).preview).toBe('const x = 1;\nconsole.log(x);')
    expect(markerOf(result, 0).retained).toMatchObject({
      ok: true,
      toolCallId: HANDLE_ID,
    })
  })

  it('returns content it may not drop, when the tool call has no handle', () => {
    const input: SavantCodeToolOutput<'read_files'> = [
      {
        type: 'json',
        value: [{ path: 'src/file1.ts', content: 'x'.repeat(40_000) }],
      },
    ]

    expect(simplifyReadFileResults({ messageContent: input })).toBe(input)
  })

  it('should handle empty file results', () => {
    const input: SavantCodeToolOutput<'read_files'> = [
      {
        type: 'json',
        value: [],
      },
    ]

    const result = simplifyReadFileResults({ messageContent: input })

    expect(result).toBe(input)
  })

  it('should handle files with contentOmittedForLength already set', () => {
    const input: SavantCodeToolOutput<'read_files'> = [
      {
        type: 'json',
        value: [
          {
            path: 'src/file1.ts',
            contentOmittedForLength: true,
          },
        ],
      },
    ]

    const result = simplifyReadFileResults({ messageContent: input })

    expect(result).toBe(input)
  })

  it('should not mutate the original input', () => {
    const originalInput: SavantCodeToolOutput<'read_files'> = [
      {
        type: 'json',
        value: [
          {
            path: 'src/file1.ts',
            content: 'const x = 1;',
          },
        ],
      },
    ]
    const input = structuredClone(originalInput)

    simplifyReadFileResults({ messageContent: input, toolCallId: HANDLE_ID })

    // Original input should be unchanged
    expect(input).toEqual(originalInput)
  })
})
