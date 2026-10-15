import { describe, expect, test } from 'bun:test'

import { extractChangedPathsFromHistory } from '../util/graph-injection'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'

describe('extractChangedPathsFromHistory (FID-2026-1013-010 W1-1)', () => {
  test('extracts target paths from write_file, str_replace, and apply_patch (operation.path)', () => {
    const history: Message[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'write_file',
            input: { path: 'src\\created.ts', content: 'export const a = 1' },
          },
          {
            type: 'tool-call',
            toolCallId: 'c2',
            toolName: 'str_replace',
            input: {
              path: 'src/modified.ts',
              replacements: [{ oldString: 'a', newString: 'b' }],
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'c3',
            toolName: 'apply_patch',
            input: {
              operation: {
                type: 'update_file',
                path: 'packages\\agent-runtime\\src\\patched.ts',
                diff: '@@\n+export const x = 2\n',
              },
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'c4',
            toolName: 'read_files',
            input: { paths: ['src/ignored-read.ts'] },
          },
        ],
      },
    ]

    expect(extractChangedPathsFromHistory(history)).toEqual([
      'src/created.ts',
      'src/modified.ts',
      'packages/agent-runtime/src/patched.ts',
    ])
  })
})
