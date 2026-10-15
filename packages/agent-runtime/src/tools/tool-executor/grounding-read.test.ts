import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  BOOT_LEARNINGS_MAX_CHARACTERS,
  BOOT_LEARNINGS_PATH,
} from '@savant-code/common/constants/learnings-boot'
import { HIDDEN_FILE_READ_STATUS } from '@savant-code/common/old-constants'
import { describe, expect, test } from 'bun:test'

import { completeGroundingReads } from './grounding-read'
import { getFiles } from '../../../../../sdk/src/tools/read-files'
import {
  createMockAgentState,
  createMockFileContext,
} from '../../templates/__tests__/strings-test-harness'
import { handleReadFiles } from '../handlers/tool/read-files'

import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'

function output(content: string): ToolMessage['content'] {
  return [{ type: 'json', value: [{ path: BOOT_LEARNINGS_PATH, content }] }]
}

describe('complete grounding reads', () => {
  test('SDK truncation and status-only responses pass through the handler without grounding credit', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'grounding-read-'))
    try {
      await fs.writeFile(path.join(root, 'large.md'), 'x'.repeat(100_001))
      const result = await handleReadFiles({
        previousToolCallFinished: Promise.resolve(),
        toolCall: {
          toolName: 'read_files',
          toolCallId: 'grounding-read',
          input: { paths: ['large.md', 'absent.md'] },
        },
        agentState: {
          ...createMockAgentState('grounding-fixture'),
          protocolSource: 'local',
        },
        fileContext: {
          ...createMockFileContext(),
          projectRoot: root,
          cwd: root,
          tokenCallers: {},
        },
        requestFiles: (input: {
          filePaths: string[]
          offset?: number
          limit?: number
        }) =>
          getFiles({
            ...input,
            cwd: root,
            fs,
            fileFilter: () => ({ status: 'allow' }),
          }),
      })
      expect(
        completeGroundingReads({ output: result.output, hasWindow: false }),
      ).toEqual([])
      expect(JSON.stringify(result.output)).toContain('FILE_TOO_LARGE:')
      expect(JSON.stringify(result.output)).toContain('FILE_DOES_NOT_EXIST')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
  test('credits complete content and reports character and UTF-8 byte counts', () => {
    expect(
      completeGroundingReads({ output: output('évidence'), hasWindow: false }),
    ).toEqual([{ path: BOOT_LEARNINGS_PATH, characters: 8, bytes: 9 }])
  })
  test('window, truncation, omitted content, empty and overbudget responses cannot complete boot', () => {
    for (const status of HIDDEN_FILE_READ_STATUS)
      expect(
        completeGroundingReads({ output: output(status), hasWindow: false }),
      ).toEqual([])
    expect(
      completeGroundingReads({
        output: output('complete-looking window'),
        hasWindow: true,
      }),
    ).toEqual([])
    for (const content of [
      '',
      '[FILE_TOO_LARGE: read a window]',
      '[...TRUNCATED DUE TO LENGTH...]',
      'x'.repeat(BOOT_LEARNINGS_MAX_CHARACTERS + 1),
    ])
      expect(
        completeGroundingReads({ output: output(content), hasWindow: false }),
      ).toEqual([])
    expect(
      completeGroundingReads({
        output: [
          {
            type: 'json',
            value: [
              { path: BOOT_LEARNINGS_PATH, contentOmittedForLength: true },
            ],
          },
        ],
        hasWindow: false,
      }),
    ).toEqual([])
  })
})
