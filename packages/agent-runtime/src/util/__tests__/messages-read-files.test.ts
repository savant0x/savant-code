import {
  assistantMessage,
  jsonToolResult,
  systemMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import { describe, expect, it, spyOn } from 'bun:test'

import { getPreviouslyReadFiles } from '../../util/messages'

import type { SavantCodeToolMessage } from '@savant-code/common/tools/list'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

// Mock logger for tests
const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

describe('getPreviouslyReadFiles', () => {
  it('returns empty array when no messages provided', () => {
    const result = getPreviouslyReadFiles({ messages: [], logger })
    expect(result).toEqual([])
  })

  it('returns empty array when no tool messages with relevant tool names', () => {
    const messages: Message[] = [
      userMessage('hello'),
      userMessage('hi'),
      {
        role: 'tool',
        toolName: 'write_file',
        toolCallId: 'test-id',
        content: jsonToolResult({
          file: 'test.ts',
          errorMessage: 'error',
        }),
      } satisfies SavantCodeToolMessage<'write_file'>,
    ]

    const result = getPreviouslyReadFiles({ messages, logger })
    expect(result).toEqual([])
  })

  it('extracts files from read_files tool messages', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'test-id',
        content: jsonToolResult([
          {
            path: 'src/test.ts',
            content: 'export function test() {}',
            referencedBy: { 'main.ts': ['line 10'] },
          },
          {
            path: 'src/utils.ts',
            content: 'export const utils = {}',
          },
        ] as const),
      } satisfies SavantCodeToolMessage<'read_files'>,
    ]

    const result = getPreviouslyReadFiles({ messages, logger })
    expect(result).toEqual([
      {
        path: 'src/test.ts',
        content: 'export function test() {}',
        referencedBy: { 'main.ts': ['line 10'] },
      },
      {
        path: 'src/utils.ts',
        content: 'export const utils = {}',
      },
    ])
  })

  it('extracts files from find_files tool messages', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'find_files',
        toolCallId: 'test-id',
        content: jsonToolResult([
          {
            path: 'components/Button.tsx',
            content: 'export const Button = () => {}',
          },
        ] as const),
      } satisfies SavantCodeToolMessage<'find_files'>,
    ]

    const result = getPreviouslyReadFiles({ messages, logger })
    expect(result).toEqual([
      {
        path: 'components/Button.tsx',
        content: 'export const Button = () => {}',
      },
    ])
  })

  it('combines files from multiple tool messages', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'test-id-1',
        content: jsonToolResult([
          {
            path: 'file1.ts',
            content: 'content 1',
          },
        ]),
      } satisfies SavantCodeToolMessage<'read_files'>,
      {
        role: 'tool',
        toolName: 'find_files',
        toolCallId: 'test-id-2',
        content: jsonToolResult([
          {
            path: 'file2.ts',
            content: 'content 2',
          },
        ]),
      } satisfies SavantCodeToolMessage<'find_files'>,
      userMessage('Some user message'),
    ]

    const result = getPreviouslyReadFiles({ messages, logger })
    expect(result).toEqual([
      { path: 'file1.ts', content: 'content 1' },
      { path: 'file2.ts', content: 'content 2' },
    ])
  })

  it('handles contentOmittedForLength files by filtering them out', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'test-id',
        content: jsonToolResult([
          {
            path: 'small-file.ts',
            content: 'small content',
          },
          {
            path: 'large-file.ts',
            contentOmittedForLength: true,
          },
          {
            path: 'another-small-file.ts',
            content: 'another small content',
          },
        ] as const),
      } satisfies SavantCodeToolMessage<'read_files'>,
    ]

    const result = getPreviouslyReadFiles({ messages, logger })
    expect(result).toEqual([
      { path: 'small-file.ts', content: 'small content' },
      { path: 'another-small-file.ts', content: 'another small content' },
    ])
  })

  it('handles malformed tool message output gracefully', () => {
    const mockLoggerError = spyOn(logger, 'error').mockImplementation(() => {})

    // Use jsonToolResult with non-array data to trigger error handling
    // The function expects an array of files but we give it an object
    const malformedMessage: Message = {
      role: 'tool' as const,
      toolName: 'read_files',
      toolCallId: 'test-id',
      content: jsonToolResult({ unexpectedFormat: true }),
    }

    const messages: Message[] = [malformedMessage]

    const result = getPreviouslyReadFiles({ messages, logger })
    expect(result).toEqual([])
    expect(mockLoggerError).toHaveBeenCalled()

    mockLoggerError.mockRestore()
  })

  it('handles find_files tool messages with error message instead of files', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'find_files',
        toolCallId: 'test-id',
        content: jsonToolResult({
          message: 'No files found matching the criteria',
        }),
      } satisfies SavantCodeToolMessage<'find_files'>,
    ]

    const result = getPreviouslyReadFiles({ messages, logger })
    expect(result).toEqual([])
  })

  it('ignores non-tool messages', () => {
    const messages: Message[] = [
      userMessage('hello'),
      assistantMessage('hi there'),
      systemMessage('system message'),
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'test-id',
        content: jsonToolResult([
          {
            path: 'test.ts',
            content: 'test content',
          },
        ]),
      } satisfies SavantCodeToolMessage<'read_files'>,
    ]

    const result = getPreviouslyReadFiles({ messages, logger })
    expect(result).toEqual([{ path: 'test.ts', content: 'test content' }])
  })

  it('handles empty file arrays in tool output', () => {
    const messages: Message[] = [
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'test-id',
        content: jsonToolResult([]),
      } satisfies SavantCodeToolMessage<'read_files'>,
    ]

    const result = getPreviouslyReadFiles({ messages, logger })
    expect(result).toEqual([])
  })
})
