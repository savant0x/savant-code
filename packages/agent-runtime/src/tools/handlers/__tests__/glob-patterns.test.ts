import { describe, it, expect, mock } from 'bun:test'

import { handleGlob } from '../tool/glob'

import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

interface GlobResultValue {
  files?: string[]
  count?: number
  message?: string
  errorMessage?: string
}

// FID-2026-0819-005 Loop 179: pattern-behavior suites split verbatim from
// glob.test.ts.

describe('handleGlob', () => {
  it('handles brace expansion patterns', async () => {
    const mockRequestClientToolCall = mock(
      async (): Promise<SavantCodeToolOutput<'glob'>> => [
        {
          type: 'json',
          value: {
            files: [
              'src/index.ts',
              'src/utils.ts',
              'src/components/Button.tsx',
              'lib/helper.js',
            ],
            count: 4,
            message: 'Found 4 file(s) matching pattern "**/*.{ts,tsx,js}"',
          },
        },
      ],
    )

    const toolCall: SavantCodeToolCall<'glob'> = {
      toolName: 'glob',
      toolCallId: 'tc-5',
      input: {
        pattern: '**/*.{ts,tsx,js}',
      },
    }

    const { output } = await handleGlob({
      previousToolCallFinished: Promise.resolve(),
      toolCall,
      requestClientToolCall: mockRequestClientToolCall,
    })

    expect(mockRequestClientToolCall).toHaveBeenCalledWith(toolCall)
    const value = output[0].value as GlobResultValue
    expect(value.count).toBe(4)
    expect(value.files?.length).toBe(4)
  })

  it('handles error responses from client', async () => {
    const mockRequestClientToolCall = mock(
      async (): Promise<SavantCodeToolOutput<'glob'>> => [
        {
          type: 'json',
          value: {
            errorMessage: 'Failed to search for files: Invalid pattern',
          },
        },
      ],
    )

    const toolCall: SavantCodeToolCall<'glob'> = {
      toolName: 'glob',
      toolCallId: 'tc-6',
      input: {
        pattern: '[invalid',
      },
    }

    const { output } = await handleGlob({
      previousToolCallFinished: Promise.resolve(),
      toolCall,
      requestClientToolCall: mockRequestClientToolCall,
    })

    expect(mockRequestClientToolCall).toHaveBeenCalledWith(toolCall)
    const value = output[0].value as GlobResultValue
    expect(value.errorMessage).toBeDefined()
    expect(value.errorMessage).toContain('Failed to search for files')
  })

  it('waits for previous tool call to finish before executing', async () => {
    let previousFinished = false
    const previousToolCallFinished = new Promise<void>((resolve) => {
      setTimeout(() => {
        previousFinished = true
        resolve()
      }, 10)
    })

    const mockRequestClientToolCall = mock(
      async (): Promise<SavantCodeToolOutput<'glob'>> => {
        expect(previousFinished).toBe(true)
        return [
          {
            type: 'json',
            value: {
              files: ['test.ts'],
              count: 1,
              message: 'Found 1 file(s) matching pattern "test.ts"',
            },
          },
        ]
      },
    )

    const toolCall: SavantCodeToolCall<'glob'> = {
      toolName: 'glob',
      toolCallId: 'tc-7',
      input: {
        pattern: 'test.ts',
      },
    }

    const { output: _output } = await handleGlob({
      previousToolCallFinished,
      toolCall,
      requestClientToolCall: mockRequestClientToolCall,
    })

    expect(previousFinished).toBe(true)
    expect(mockRequestClientToolCall).toHaveBeenCalled()
  })

  it('handles nested directory patterns with cwd', async () => {
    const mockRequestClientToolCall = mock(
      async (): Promise<SavantCodeToolOutput<'glob'>> => [
        {
          type: 'json',
          value: {
            files: [
              'src/components/Button.tsx',
              'src/components/Input.tsx',
              'src/components/Modal.tsx',
            ],
            count: 3,
            message:
              'Found 3 file(s) matching pattern "components/*.tsx" in directory "src"',
          },
        },
      ],
    )

    const toolCall: SavantCodeToolCall<'glob'> = {
      toolName: 'glob',
      toolCallId: 'tc-8',
      input: {
        pattern: 'components/*.tsx',
        cwd: 'src',
      },
    }

    const { output } = await handleGlob({
      previousToolCallFinished: Promise.resolve(),
      toolCall,
      requestClientToolCall: mockRequestClientToolCall,
    })

    expect(mockRequestClientToolCall).toHaveBeenCalledWith(toolCall)
    const value = output[0].value as GlobResultValue
    expect(value.files?.length).toBe(3)
    expect(value.files?.every((f) => f.includes('components'))).toBe(true)
  })
})
