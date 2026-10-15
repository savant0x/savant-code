import { AbortError } from '@savant-code/common/util/error'
import { resolveAndContain } from '@savant-code/common/util/paths'
import { partition } from 'lodash'

import { processFileBlock } from '../../../process-file-block'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { RequestOptionalFileFn } from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

type FileProcessingTools = 'write_file' | 'str_replace' | 'create_plan'
export type FileProcessing<
  T extends FileProcessingTools = FileProcessingTools,
> = {
  tool: T
  path: string
  toolCallId: string
} & (
  | {
      content: string
      patch?: string
      messages: string[]
    }
  | {
      error: string
    }
)

export type FileProcessingState = {
  promisesByPath: Record<string, Promise<FileProcessing>[]>
  allPromises: Promise<FileProcessing>[]
  fileChangeErrors: Extract<FileProcessing, { error: string }>[]
  fileChanges: Exclude<FileProcessing, { error: string }>[]
  firstFileProcessed: boolean
}

export function getFileProcessingValues(
  state: FileProcessingState,
): FileProcessingState {
  return {
    promisesByPath: { ...state.promisesByPath },
    allPromises: [...state.allPromises],
    fileChangeErrors: [...state.fileChangeErrors],
    fileChanges: [...state.fileChanges],
    firstFileProcessed: state.firstFileProcessed,
  }
}

/**
 * Return the exact successful content for one completed file-tool call.
 * `undefined` means no successful content snapshot was produced; `''` is
 * deliberately returned for a successful empty-file write.
 */
export function getSuccessfulFileContent(params: {
  state: FileProcessingState
  path: string
  toolCallId: string
}): string | undefined {
  const change = params.state.fileChanges.find(
    (candidate) =>
      candidate.path === params.path &&
      candidate.toolCallId === params.toolCallId,
  )
  return change?.content
}

export const handleWriteFile = (async (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SavantCodeToolCall<'write_file'>

    agentState: AgentState
    clientSessionId: string
    fileProcessingState: FileProcessingState
    fingerprintId: string
    fileContext?: ProjectFileContext
    logger: Logger
    prompt: string | undefined
    userId: string | undefined
    userInputId: string

    requestClientToolCall: (
      toolCall: ClientToolCall<'write_file'>,
    ) => Promise<SavantCodeToolOutput<'write_file'>>
    requestOptionalFile: RequestOptionalFileFn
    writeToClient: (chunk: string) => void
  } & ParamsExcluding<RequestOptionalFileFn, 'filePath'>,
): Promise<{ output: SavantCodeToolOutput<'write_file'> }> => {
  const {
    previousToolCallFinished,
    toolCall,

    fileProcessingState,
    logger,

    requestClientToolCall,
    requestOptionalFile,
    writeToClient,
  } = params
  const { path, content } = toolCall.input

  const projectRoot = params.fileContext?.projectRoot
  if (!projectRoot) {
    return {
      output: [
        {
          type: 'json' as const,
          value: {
            file: path,
            errorMessage:
              'write_file: fileContext.projectRoot missing — project config invalid',
          },
        },
      ],
    }
  }
  const pathCheck = resolveAndContain(path, { projectRoot })
  if (pathCheck.kind === 'reject') {
    return {
      output: [
        {
          type: 'json' as const,
          value: {
            file: path,
            errorMessage: `write_file: ${pathCheck.reason}`,
          },
        },
      ],
    }
  }

  const fileProcessingPromisesByPath = fileProcessingState.promisesByPath
  const fileProcessingPromises = fileProcessingState.allPromises

  if (!fileProcessingPromisesByPath[path]) {
    fileProcessingPromisesByPath[path] = []
  }
  const previousPromises = fileProcessingPromisesByPath[path]
  const previousEdit = previousPromises[previousPromises.length - 1]

  const latestContentPromise = previousEdit
    ? previousEdit.then((maybeResult) =>
        maybeResult && 'content' in maybeResult
          ? maybeResult.content
          : requestOptionalFile({ ...params, filePath: path }),
      )
    : requestOptionalFile({ ...params, filePath: path })

  const fileContentWithoutStartNewline = content.startsWith('\n')
    ? content.slice(1)
    : content

  logger.debug({ path, contentChars: content.length }, `write_file ${path}`)

  const newPromise = processFileBlock({
    path,
    initialContentPromise: latestContentPromise,
    newContent: fileContentWithoutStartNewline,
    logger,
  })
    .then((result) => {
      if (result.aborted) {
        throw new AbortError(result.reason)
      }
      return result.value
    })
    .catch((error) => {
      if (error instanceof AbortError) {
        throw error
      }
      logger.error({ path }, 'Error processing write_file block')
      return {
        tool: 'write_file' as const,
        path,
        error:
          'Error: Failed to process the write_file block. Re-read the file before retrying.',
      }
    })
    .then(async (fileProcessingResult) => ({
      ...fileProcessingResult,
      toolCallId: toolCall.toolCallId,
    }))
  fileProcessingPromisesByPath[path].push(newPromise)
  fileProcessingPromises.push(newPromise)

  await previousToolCallFinished

  return {
    output: await postStreamProcessing<'write_file'>(
      await newPromise,
      fileProcessingState,
      writeToClient,
      requestClientToolCall,
    ),
  }
}) satisfies SavantCodeToolHandlerFunction<'write_file'>

export async function postStreamProcessing<T extends FileProcessingTools>(
  toolCall: FileProcessing<T>,
  fileProcessingState: FileProcessingState,
  writeToClient: (chunk: string) => void,
  requestClientToolCall: (
    toolCall: ClientToolCall<T>,
  ) => Promise<SavantCodeToolOutput<T>>,
): Promise<SavantCodeToolOutput<T>> {
  const allFileProcessingResults = await Promise.all(
    fileProcessingState.allPromises,
  )
  if (!fileProcessingState.firstFileProcessed) {
    ;[fileProcessingState.fileChangeErrors, fileProcessingState.fileChanges] =
      partition(allFileProcessingResults, (result) => 'error' in result)

    if (
      fileProcessingState.fileChanges.length === 0 &&
      allFileProcessingResults.length > 0
    ) {
      writeToClient('No changes to existing files.\n')
    }
    if (fileProcessingState.fileChanges.length > 0) {
      writeToClient(`\n`)
    }
    fileProcessingState.firstFileProcessed = true
  } else {
    const [newErrors, newChanges] = partition(
      allFileProcessingResults,
      (result) => 'error' in result,
    )
    fileProcessingState.fileChangeErrors = newErrors as Extract<
      FileProcessing,
      { error: string }
    >[]
    fileProcessingState.fileChanges = newChanges as Exclude<
      FileProcessing,
      { error: string }
    >[]
  }

  const errors = fileProcessingState.fileChangeErrors.filter(
    (result) => result.toolCallId === toolCall.toolCallId,
  )
  if (errors.length > 0) {
    if (errors.length > 1) {
      throw new Error(
        `Internal error: Unexpected number of matching errors, found ${errors.length}, expected 1`,
      )
    }

    const { path, error } = errors[0]
    return [
      {
        type: 'json',
        value: {
          file: path,
          errorMessage: error,
        },
      },
    ]
  }

  const changes = fileProcessingState.fileChanges.filter(
    (result) => result.toolCallId === toolCall.toolCallId,
  )
  if (changes.length !== 1) {
    throw new Error(
      `Internal error: Unexpected number of matching changes, found ${changes.length}, expected 1`,
    )
  }

  const { patch, content, path } = changes[0]
  const clientToolCall: ClientToolCall<T> = {
    toolCallId: toolCall.toolCallId,
    toolName: toolCall.tool,
    input: patch
      ? { type: 'patch' as const, path, content: patch }
      : { type: 'file' as const, path, content },
  } as ClientToolCall<T>
  return await requestClientToolCall(clientToolCall)
}
