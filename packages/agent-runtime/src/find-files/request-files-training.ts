import { models } from '@savant-code/common/old-constants'
import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { unwrapPromptResult } from '@savant-code/common/util/error'
import { userMessage } from '@savant-code/common/util/messages'

import { getMessagesSubset, messagesWithSystem } from '../util/messages'
import { validateFilePaths } from './request-files-prompt/validate'

import type { InventoryContext } from '../evidence/inventory'
import type { TextBlock } from '../llm-api/claude'
import type { PromptAiSdkFn } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * The TRAINING-only file picker (ceiling split out of `./request-files-prompt`).
 *
 * It is the same shape as the session picker in that module — the token-budget
 * trim pass over the history, then a model call — but it is reached only from
 * `uploadExpandedFileContextForTraining`, which the caller gates behind
 * `COLLECT_FULL_FILE_CONTEXT`. Keeping it beside the session path was what pushed
 * that module past the quality ceiling, and the extraction is verbatim: the FID
 * that owns the trim ledger (FID-2026-1007-004 step 4) cares about both call
 * sites, so both pass the same `evidenceContext`.
 */
export async function getRelevantFilesForTraining(
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
    evidenceContext?: InventoryContext
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
  const response = unwrapPromptResult(
    await promptAiSdk({
      ...params,
      messages: messagesWithSystem({ messages: messagesWithPrompt, system }),
      model: models.openrouter_claude_sonnet_4,
      modelRoute: captureModelRoute('openrouter'),
      contextWindow: undefined,
      maxOutputTokens: undefined,
      chargeUser: false,
    }),
  )
  const end = performance.now()
  const duration = end - start

  const files = validateFilePaths(response.split('\n'))

  return { files, duration, requestType, response }
}
