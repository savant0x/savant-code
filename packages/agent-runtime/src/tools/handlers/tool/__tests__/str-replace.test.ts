import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { describe, expect, test } from 'bun:test'

import { processFileBlock } from '../../../../process-file-block'
import { processStrReplace } from '../../../../process-str-replace'
import { handleStrReplace } from '../str-replace'

import type { FileProcessingState } from '../write-file'
import type {
  LogValue,
  Logger,
} from '@savant-code/common/types/contracts/logger'

function captureLogger(logs: string[]): Logger {
  const capture = (value: LogValue): void => {
    logs.push(JSON.stringify(value))
  }
  return { debug: capture, info: capture, warn: capture, error: capture }
}

describe('FID-020 actual edit-handler boundary', () => {
  test('a frozen client success survives appended partial-edit diagnostics', async () => {
    const logs: string[] = []
    const clientValue = Object.freeze({
      file: 'fixture.ts',
      message: 'written',
    })
    const first = Object.freeze({ type: 'json' as const, value: clientValue })
    const state: FileProcessingState = {
      promisesByPath: {},
      allPromises: [],
      fileChangeErrors: [],
      fileChanges: [],
      firstFileProcessed: false,
    }
    const result = await handleStrReplace({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolName: 'str_replace',
        toolCallId: 'frozen-edit',
        input: {
          path: 'fixture.ts',
          replacements: [
            {
              oldString: 'value = 1',
              newString: 'value = 2',
              allowMultiple: false,
            },
            { oldString: 'absent', newString: 'other', allowMultiple: false },
          ],
        },
      },
      fileProcessingState: state,
      fileContext: {
        ...getStubProjectFileContext(),
        projectRoot: process.cwd(),
      },
      logger: captureLogger(logs),
      writeToClient: () => {},
      requestOptionalFile: async () => 'const value = 1\n',
      requestClientToolCall: async () => [first],
    })
    expect(clientValue.message).toBe('written')
    expect(result.output[0].value).not.toBe(clientValue)
    expect(JSON.stringify(result.output)).toContain('was not found')
    expect(JSON.stringify(result.output)).toContain('written')
  })

  test('write and replacement processing log sizes rather than content', async () => {
    const logs: string[] = []
    const logger = captureLogger(logs)
    const body = 'private-file-body sk-fixture-secretvalue123456'
    await processFileBlock({
      path: 'fixture.ts',
      initialContentPromise: Promise.resolve(null),
      newContent: body,
      logger,
    })
    await processFileBlock({
      path: 'fixture.ts',
      initialContentPromise: Promise.resolve(body),
      newContent: body,
      logger,
    })
    await processFileBlock({
      path: 'fixture.ts',
      initialContentPromise: Promise.resolve('old'),
      newContent: body,
      logger,
    })
    await processStrReplace({
      path: 'fixture.ts',
      initialContentPromise: Promise.resolve(body),
      logger,
      replacements: [
        { oldString: body, newString: 'changed', allowMultiple: false },
      ],
    })
    expect(logs.join('\n')).not.toContain(body)
    expect(logs.join('\n')).toContain('contentChars')
  })
})
