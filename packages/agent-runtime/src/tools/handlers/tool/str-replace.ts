import { resolveAndContain } from '@savant-code/common/util/paths'
import { toLogValue } from '@savant-code/common/util/type-narrowing'

import { postStreamProcessing } from './write-file'
import { processStrReplace } from '../../../process-str-replace'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type { FileProcessingState } from './write-file'
import type {
  ClientToolCall,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { RequestOptionalFileFn } from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { ProjectFileContext } from '@savant-code/common/util/file'

export const handleStrReplace = (async (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SavantCodeToolCall<'str_replace'>

    fileProcessingState: FileProcessingState
    // Optional to support test fixtures / partial mocks. Runtime always provides
    // this via executeToolCall. Null-check defensively to fail soft.
    fileContext?: ProjectFileContext
    logger: Logger

    requestClientToolCall: (
      toolCall: ClientToolCall<'str_replace'>,
    ) => Promise<SavantCodeToolOutput<'str_replace'>>
    writeToClient: (chunk: string) => void

    requestOptionalFile: RequestOptionalFileFn
  } & ParamsExcluding<RequestOptionalFileFn, 'filePath'>,
): Promise<{ output: SavantCodeToolOutput<'str_replace'> }> => {
  const {
    previousToolCallFinished,
    toolCall,

    fileProcessingState,
    logger,

    requestClientToolCall,
    requestOptionalFile,
    writeToClient,
  } = params
  const { path, replacements } = toolCall.input

  // FID-2026-0718-013 v3 — defense-in-depth (mirror write-file.ts).
  const projectRoot = params.fileContext?.projectRoot
  if (!projectRoot) {
    return {
      output: [
        {
          type: 'json' as const,
          value: {
            file: path,
            errorMessage:
              'str_replace: fileContext.projectRoot missing — project config invalid',
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
            errorMessage: `str_replace: ${pathCheck.reason}`,
          },
        },
      ],
    }
  }

  if (!fileProcessingState.promisesByPath[path]) {
    fileProcessingState.promisesByPath[path] = []
  }

  const previousPromises = fileProcessingState.promisesByPath[path]
  const previousEdit = previousPromises[previousPromises.length - 1]

  const latestContentPromise = previousEdit
    ? previousEdit.then((maybeResult) =>
        maybeResult && 'content' in maybeResult
          ? maybeResult.content
          : requestOptionalFile({ ...params, filePath: path }),
      )
    : requestOptionalFile({ ...params, filePath: path })

  const newPromise = processStrReplace({
    path,
    replacements,
    initialContentPromise: latestContentPromise,
    logger,
  })
    .catch((error: unknown) => {
      logger.error(toLogValue(error), 'Error processing str_replace block')
      return {
        tool: 'str_replace' as const,
        path,
        error: 'Unknown error: Failed to process the str_replace block.',
      }
    })
    .then((fileProcessingResult) => ({
      ...fileProcessingResult,
      toolCallId: toolCall.toolCallId,
    }))

  fileProcessingState.promisesByPath[path].push(newPromise)
  fileProcessingState.allPromises.push(newPromise)

  await previousToolCallFinished

  const strReplaceResult = await newPromise
  const clientToolResult = await postStreamProcessing<'str_replace'>(
    strReplaceResult,
    fileProcessingState,
    writeToClient,
    requestClientToolCall,
  )

  // FID-2026-1012-020: never assign into the client's result object. A frozen
  // or shared client result threw `Attempted to assign to readonly property.`
  // here and lost the edit result entirely — build a new value instead.
  const first = clientToolResult[0]
  const firstValue = first.value
  if ('messages' in strReplaceResult && 'message' in firstValue) {
    return {
      output: [
        {
          ...first,
          value: {
            ...firstValue,
            message: [...strReplaceResult.messages, firstValue.message].join(
              '\n\n',
            ),
          },
        },
      ],
    }
  }

  return { output: clientToolResult }
}) satisfies SavantCodeToolHandlerFunction<'str_replace'>
