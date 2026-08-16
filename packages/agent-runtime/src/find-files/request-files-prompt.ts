import {
  finetunedVertexModels,
  models,
  type FinetunedVertexModel,
} from '@savant-code/common/old-constants'
import {
  isAbortError,
  unwrapPromptResult,
} from '@savant-code/common/util/error'
import { systemMessage, userMessage } from '@savant-code/common/util/messages'
import { uniq } from 'lodash'

import { promptFlashWithFallbacks } from '../llm-api/gemini-with-fallbacks'
import {
  castAssistantMessage,
  messagesWithSystem,
  getMessagesSubset,
} from '../util/messages'
import {
  generateKeyRequestFilesPrompt,
  generateNonObviousRequestFilesPrompt,
} from './request-files-prompt/prompts'
import { validateFilePaths } from './request-files-prompt/validate'

import type { TextBlock } from '../llm-api/claude'
import type { PromptAiSdkFn } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ProjectFileContext } from '@savant-code/common/util/file'

const MAX_FILES_PER_REQUEST = 30

export async function requestRelevantFiles(
  params: {
    messages: Message[]
    system: string | Array<TextBlock>
    fileContext: ProjectFileContext
    assistantPrompt: string | null
    agentStepId: string
    clientSessionId: string
    fingerprintId: string
    userInputId: string
    userId: string | undefined
    repoId: string | undefined
    logger: Logger
  } & ParamsExcluding<
    typeof getRelevantFiles,
    'messages' | 'userPrompt' | 'requestType' | 'modelId'
  >,
) {
  const { messages, fileContext, assistantPrompt, logger } = params

  const countPerRequest = 12

  // Use custom max files per request if specified, otherwise default to 30

  const lastMessage = messages[messages.length - 1]
  const messagesExcludingLastIfByUser =
    lastMessage.role === 'user' ? messages.slice(0, -1) : messages
  const userPrompt =
    lastMessage.role === 'user'
      ? typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content)
      : ''

  // Only proceed to get key files if new files are necessary
  const keyPrompt = generateKeyRequestFilesPrompt(
    userPrompt,
    assistantPrompt,
    fileContext,
    countPerRequest,
  )

  let modelIdForRequest: FinetunedVertexModel | undefined = undefined

  const keyPromise = getRelevantFiles({
    ...params,
    messages: messagesExcludingLastIfByUser,
    userPrompt: keyPrompt,
    requestType: 'Key',
    modelId: modelIdForRequest,
  }).catch((error) => {
    // Don't swallow abort errors - propagate them immediately
    if (isAbortError(error)) {
      throw error
    }
    logger.error({ error }, 'Error requesting key files')
    return { files: [] as string[], duration: 0 }
  })

  const keyFiles = await keyPromise
  const candidateFiles = keyFiles.files

  validateFilePaths(uniq(candidateFiles))

  // logger.info(
  //   {
  //     files,
  //     customFilePickerConfig: customFilePickerConfig,
  //     modelName: customFilePickerConfig?.modelName,
  //     orgId,
  //   },
  //   'requestRelevantFiles: results',
  // )

  return candidateFiles.slice(0, MAX_FILES_PER_REQUEST)
}

export async function requestRelevantFilesForTraining(
  params: {
    messages: Message[]
    fileContext: ProjectFileContext
    assistantPrompt: string | null
    logger: Logger
  } & ParamsExcluding<
    typeof getRelevantFilesForTraining,
    'messages' | 'userPrompt' | 'requestType'
  >,
) {
  const { messages, fileContext, assistantPrompt, logger } = params
  const COUNT = 50

  const lastMessage = messages[messages.length - 1]
  const messagesExcludingLastIfByUser =
    lastMessage.role === 'user' ? messages.slice(0, -1) : messages
  const userPrompt =
    lastMessage.role === 'user'
      ? typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content)
      : ''

  const keyFilesPrompt = generateKeyRequestFilesPrompt(
    userPrompt,
    assistantPrompt,
    fileContext,
    COUNT,
  )
  const nonObviousPrompt = generateNonObviousRequestFilesPrompt(
    userPrompt,
    assistantPrompt,
    fileContext,
    COUNT,
  )

  const keyFiles = await getRelevantFilesForTraining({
    ...params,
    messages: messagesExcludingLastIfByUser,
    userPrompt: keyFilesPrompt,
    requestType: 'Key',
  })

  const nonObviousFiles = await getRelevantFilesForTraining({
    ...params,
    messages: messagesExcludingLastIfByUser,
    userPrompt: nonObviousPrompt,
    requestType: 'Non-Obvious',
  })

  const candidateFiles = [...keyFiles.files, ...nonObviousFiles.files]
  const validatedFiles = validateFilePaths(uniq(candidateFiles))
  logger.debug(
    { keyFiles, nonObviousFiles, validatedFiles },
    'requestRelevantFilesForTraining: results',
  )
  return validatedFiles.slice(0, MAX_FILES_PER_REQUEST)
}

async function getRelevantFiles(
  params: {
    messages: Message[]
    system: string | Array<TextBlock>
    userPrompt: string
    requestType: string
    agentStepId: string
    clientSessionId: string
    fingerprintId: string
    userInputId: string
    userId: string | undefined
    repoId: string | undefined
    modelId?: FinetunedVertexModel
    logger: Logger
  } & ParamsExcluding<
    typeof promptFlashWithFallbacks,
    'messages' | 'model' | 'useFinetunedModel'
  >,
) {
  const {
    messages,
    system,
    userPrompt,
    requestType,
    agentStepId: _agentStepId,
    clientSessionId: _clientSessionId,
    fingerprintId: _fingerprintId,
    userInputId: _userInputId,
    userId: _userId,
    repoId: _repoId,
    modelId,
    logger,
  } = params
  const bufferTokens = 100_000
  const messagesWithPrompt = getMessagesSubset({
    messages: [...messages, userMessage(userPrompt)],
    otherTokens: bufferTokens,
    logger,
  })
  const start = performance.now()
  let savantCodeMessages = [systemMessage(system), ...messagesWithPrompt]

  // Converts assistant messages to user messages for finetuned model
  savantCodeMessages = savantCodeMessages
    .map((msg, i) => {
      if (msg.role === 'assistant' && i !== savantCodeMessages.length - 1) {
        return castAssistantMessage(msg)
      } else {
        return msg
      }
    })
    .filter((msg) => msg !== null)
  const finetunedModel = modelId ?? finetunedVertexModels.ft_filepicker_010

  let response = await promptFlashWithFallbacks({
    ...params,
    messages: savantCodeMessages,
    model: models.openrouter_gemini2_5_flash,
    useFinetunedModel: finetunedModel,
  })
  const end = performance.now()
  const duration = end - start

  const files = validateFilePaths(response.split('\n'))

  return { files, duration, requestType, response }
}

/**
 * Gets relevant files for training using Claude Sonnet.
 *
 * @throws {Error} When the request is aborted by user. Check with `isAbortError()`.
 */
async function getRelevantFilesForTraining(
  params: {
    messages: Message[]
    system: string | Array<TextBlock>
    userPrompt: string
    requestType: string
    agentStepId: string
    clientSessionId: string
    fingerprintId: string
    userInputId: string
    userId: string | undefined
    repoId: string | undefined
    promptAiSdk: PromptAiSdkFn
    logger: Logger
  } & ParamsExcluding<PromptAiSdkFn, 'messages' | 'model' | 'chargeUser'>,
) {
  const {
    messages,
    system,
    userPrompt,
    requestType,
    agentStepId: _agentStepId,
    clientSessionId: _clientSessionId,
    fingerprintId: _fingerprintId,
    userInputId: _userInputId,
    userId: _userId,
    repoId: _repoId,
    promptAiSdk,
    logger,
  } = params
  const bufferTokens = 100_000
  const messagesWithPrompt = getMessagesSubset({
    messages: [...messages, userMessage(userPrompt)],
    otherTokens: bufferTokens,
    logger,
  })
  const start = performance.now()
  const response = unwrapPromptResult(
    await promptAiSdk({
      ...params,
      messages: messagesWithSystem({ messages: messagesWithPrompt, system }),
      model: models.openrouter_claude_sonnet_4,
      chargeUser: false,
    }),
  )
  const end = performance.now()
  const duration = end - start

  const files = validateFilePaths(response.split('\n'))

  return { files, duration, requestType, response }
}
