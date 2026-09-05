// simplify-tool-results — read-files output simplification.
// Parent of the Loop 327 decomposition (terminal-command, truncation, and
// verbose-pre-pass suites live in sibling files).

import { describe, expect, it } from 'bun:test'

import { simplifyReadFileResults } from '../simplify-tool-results'

import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'

describe('simplifyReadFileResults', () => {
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

    const result = simplifyReadFileResults(input)

    expect(result).toEqual([
      {
        type: 'json',
        value: [
          {
            path: 'src/file1.ts',
            contentOmittedForLength: true,
          },
          {
            path: 'src/file2.ts',
            contentOmittedForLength: true,
          },
        ],
      },
    ])
  })

  it('should handle empty file results', () => {
    const input: SavantCodeToolOutput<'read_files'> = [
      {
        type: 'json',
        value: [],
      },
    ]

    const result = simplifyReadFileResults(input)

    expect(result).toEqual([
      {
        type: 'json',
        value: [],
      },
    ])
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

    const result = simplifyReadFileResults(input)

    expect(result).toEqual([
      {
        type: 'json',
        value: [
          {
            path: 'src/file1.ts',
            contentOmittedForLength: true,
          },
        ],
      },
    ])
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

    simplifyReadFileResults(input)

    // Original input should be unchanged
    expect(input).toEqual(originalInput)
  })
})
