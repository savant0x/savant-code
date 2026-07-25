import { jsonToolResult } from '@savant-code/common/util/messages'

import {
  requestRelevantFiles,
  requestRelevantFilesForTraining,
} from '../../../find-files/request-files-prompt'
import { getFileReadingUpdates } from '../../../get-file-reading-updates'
import { getSearchSystemPrompt } from '../../../system-prompt/search-system-prompt'
import { renderReadFilesResult } from '../../../util/render-read-files-result'
import { countTokens, countTokensJson } from '../../../util/token-counter'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { RequestFilesFn } from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type {
  ParamsExcluding,
  ParamsOf,
} from '@savant-code/common/types/function-params'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

// Turn this on to collect full file context, using Claude-4-Opus to pick which files to send up
// NOTE: We might want to be able to turn this on on a per-repo basis.
const COLLECT_FULL_FILE_CONTEXT = false

export const handleFindFiles = (async (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SavantCodeToolCall<'find_files'>
    logger: Logger

    agentState: AgentState
    agentStepId: string
    clientSessionId: string
    fileContext: ProjectFileContext
    fingerprintId: string
    repoId: string | undefined
    userId: string | undefined
    userInputId: string
  } & ParamsExcluding<
    typeof requestRelevantFiles,
    'messages' | 'system' | 'assistantPrompt'
  > &
    ParamsExcluding<
      typeof uploadExpandedFileContextForTraining,
      'messages' | 'system' | 'assistantPrompt'
    > &
    ParamsExcluding<typeof getFileReadingUpdates, 'requestedFiles'>,
): Promise<{ output: SavantCodeToolOutput<'find_files'> }> => {
  const {
    previousToolCallFinished,
    toolCall,

    agentState,
    agentStepId,
    clientSessionId,
    fileContext,
    fingerprintId,
    logger,
    userId,
    userInputId,
  } = params
  const { prompt } = toolCall.input

  const fileRequestMessagesTokens = countTokensJson(agentState.messageHistory as JSONValue)
  const system = getSearchSystemPrompt({
    fileContext,
    messagesTokens: fileRequestMessagesTokens,
    logger,
    options: {
      agentStepId,
      clientSessionId,
      fingerprintId,
      userInputId,
      userId,
    },
  })

  await previousToolCallFinished

  const requestedFiles = await requestRelevantFiles({
    ...params,
    messages: agentState.messageHistory,
    system,
    assistantPrompt: prompt,
  })

  if (requestedFiles && requestedFiles.length > 0) {
    const addedFiles = await getFileReadingUpdates({
      ...params,
      requestedFiles,
    })

    if (COLLECT_FULL_FILE_CONTEXT && addedFiles.length > 0) {
      uploadExpandedFileContextForTraining({
        ...params,
        messages: agentState.messageHistory,
        system,
        assistantPrompt: prompt,
      }).catch((error) => {
        logger.error(
          { error },
          'Error uploading expanded file context for training',
        )
      })
    }

    if (addedFiles.length > 0) {
      return {
        output: jsonToolResult(
          renderReadFilesResult(addedFiles, fileContext.tokenCallers ?? {}),
        ),
      }
    }
    return {
      output: jsonToolResult({
        message: `No new relevant files found for prompt: ${prompt}`,
      }),
    }
  } else {
    return {
      output: jsonToolResult({
        message: `No relevant files found for prompt: ${prompt}`,
      }),
    }
  }
}) satisfies SavantCodeToolHandlerFunction<'find_files'>

async function uploadExpandedFileContextForTraining(
  params: {
    requestFiles: RequestFilesFn
  } & ParamsOf<typeof requestRelevantFilesForTraining>,
) {
  const { requestFiles } = params
  const files = await requestRelevantFilesForTraining(params)

  const loadedFiles = await requestFiles({ filePaths: files })

  // Upload a map of:
  // {file_path: {content, token_count}}
  // up to 50k tokens
  const filesToUpload: Record<string, { content: string; tokens: number }> = {}
  for (const file of files) {
    const content = loadedFiles[file]
    if (content === null || content === undefined) {
      continue
    }
    const tokens = countTokens(content)
    if (tokens > 50000) {
      break
    }
    filesToUpload[file] = { content, tokens }
  }
}
