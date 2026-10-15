import {
  finetunedVertexModels,
  models,
  type FinetunedVertexModel,
} from '@savant-code/common/old-constants'
import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { isAbortError } from '@savant-code/common/util/error'
import { systemMessage, userMessage } from '@savant-code/common/util/messages'
import { uniq } from 'lodash'

import { promptFlashWithFallbacks } from '../llm-api/gemini-with-fallbacks'
import { castAssistantMessage, getMessagesSubset } from '../util/messages'
import {
  generateKeyRequestFilesPrompt,
  generateNonObviousRequestFilesPrompt,
} from './request-files-prompt/prompts'
import { validateFilePaths } from './request-files-prompt/validate'
import { getRelevantFilesForTraining } from './request-files-training'

import type { InventoryContext } from '../evidence/inventory'
import type { TextBlock } from '../llm-api/claude'
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
    /** FID-2026-1007-004 step 4: where the trim pass ledgers what it takes. */
    evidenceContext?: InventoryContext
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

  return candidateFiles.slice(0, MAX_FILES_PER_REQUEST)
}

export async function requestRelevantFilesForTraining(
  params: {
    messages: Message[]
    fileContext: ProjectFileContext
    assistantPrompt: string | null
    logger: Logger
    evidenceContext?: InventoryContext
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
    evidenceContext?: InventoryContext
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
    evidenceContext,
  } = params
  const bufferTokens = 100_000
  const messagesWithPrompt = getMessagesSubset({
    messages: [...messages, userMessage(userPrompt)],
    otherTokens: bufferTokens,
    logger,
    inventory: evidenceContext,
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
    modelRoute: captureModelRoute('openrouter'),
    contextWindow: undefined,
    maxOutputTokens: undefined,
    useFinetunedModel: finetunedModel,
  })
  const end = performance.now()
  const duration = end - start

  const files = validateFilePaths(response.split('\n'))

  return { files, duration, requestType, response }
}

// The training-only picker lives in `./request-files-training` (300-line ceiling
// split); `requestRelevantFilesForTraining` below is its only caller.
