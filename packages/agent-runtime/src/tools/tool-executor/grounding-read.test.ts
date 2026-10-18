import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  BOOT_LEARNINGS_MAX_CHARACTERS,
  BOOT_LEARNINGS_PATH,
} from '@savant-code/common/constants/learnings-boot'
import { HIDDEN_FILE_READ_STATUS } from '@savant-code/common/old-constants'
import { describe, expect, test } from 'bun:test'

import { completeGroundingReads, readLineWindow } from './grounding-read'
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
        completeGroundingReads({ output: result.output, lineWindow: {} }),
      ).toEqual([])
      expect(JSON.stringify(result.output)).toContain('FILE_TOO_LARGE:')
      expect(JSON.stringify(result.output)).toContain('FILE_DOES_NOT_EXIST')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
  test('credits complete content and reports character and UTF-8 byte counts', () => {
    expect(
      completeGroundingReads({ output: output('évidence'), lineWindow: {} }),
    ).toEqual([{ path: BOOT_LEARNINGS_PATH, characters: 8, bytes: 9 }])
  })
  test('window, truncation, omitted content, empty and overbudget responses cannot complete boot', () => {
    for (const status of HIDDEN_FILE_READ_STATUS)
      expect(
        completeGroundingReads({ output: output(status), lineWindow: {} }),
      ).toEqual([])
    expect(
      completeGroundingReads({
        output: output('complete-looking window'),
        lineWindow: { offset: 2 },
      }),
    ).toEqual([])
    for (const content of [
      '',
      '[FILE_TOO_LARGE: read a window]',
      '[...TRUNCATED DUE TO LENGTH...]',
      'x'.repeat(BOOT_LEARNINGS_MAX_CHARACTERS + 1),
    ])
      expect(
        completeGroundingReads({ output: output(content), lineWindow: {} }),
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
        lineWindow: {},
      }),
    ).toEqual([])
  })
  // FID-2026-1018-009: a limit the response never used up is not a window.
  // The model reads ECHO.md with `limit: 2000` on a 923-line file and got the
  // whole file; the old key-presence test withheld credit, so the required
  // grounding set could never complete and the turn ended ungrounded.
  test('a limit the response did not use up still credits the complete file', () => {
    const whole = `${'# line\n'.repeat(923)}`
    expect(
      completeGroundingReads({
        output: output(whole),
        lineWindow: { limit: 2000 },
      }),
    ).toEqual([
      {
        path: BOOT_LEARNINGS_PATH,
        characters: whole.length,
        bytes: Buffer.byteLength(whole, 'utf8'),
      },
    ])
    expect(
      completeGroundingReads({
        output: output(whole),
        lineWindow: { offset: 1, limit: 2000 },
      }).length,
    ).toBe(1)
  })
  test('a limit the response used up stays a partial read', () => {
    expect(
      completeGroundingReads({
        output: output('a\nb\nc\n'),
        lineWindow: { limit: 3 },
      }),
    ).toEqual([])
    expect(
      completeGroundingReads({
        output: output('a\nb\nc'),
        lineWindow: { limit: 2 },
      }),
    ).toEqual([])
  })
  test('the requested window is read from the call input, junk ignored', () => {
    expect(readLineWindow({ offset: 500, limit: 60 })).toEqual({
      offset: 500,
      limit: 60,
    })
    expect(readLineWindow({ offset: '3', limit: null })).toEqual({
      offset: undefined,
      limit: undefined,
    })
    expect(readLineWindow(undefined)).toEqual({
      offset: undefined,
      limit: undefined,
    })
  })
})
