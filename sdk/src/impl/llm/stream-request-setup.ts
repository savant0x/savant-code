// FID-2026-0819-005 Loop 240: stream request setup, extracted verbatim from
// stream.ts (abort short-circuit + model resolution + ChatGPT OAuth request
// telemetry). Pure async setup — no streaming side effects.

import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { promptAborted } from '@savant-code/common/util/error'

import { getModelForRequest } from '../model-provider'

import type { ModelRequestParams } from '../model-provider'
import type { PromptAiSdkStreamFn } from '@savant-code/common/types/contracts/llm'
import type { ParamsOf } from '@savant-code/common/types/function-params'

type StreamParams = ParamsOf<PromptAiSdkStreamFn> & {
  skipChatGptOAuth?: boolean
  chatGptOAuthRetried?: boolean
}

export type PreparedLlmStreamRequest =
  | { aborted: true; result: ReturnType<typeof promptAborted> }
  | {
      aborted: false
      aiSDKModel: Awaited<ReturnType<typeof getModelForRequest>>['model']
      isChatGptOAuth: boolean
    }

export async function prepareLlmStreamRequest(
  params: StreamParams,
  ctx: Pick<StreamParams, 'logger' | 'trackEvent'>,
): Promise<PreparedLlmStreamRequest> {
  const {
    logger,
    trackEvent,
    userId,
    userInputId,
    model: requestedModel,
  } = params

  if (params.signal.aborted) {
    logger.info(
      {
        userId: params.userId,
        userInputId: params.userInputId,
      },
      'Skipping stream due to canceled user input',
    )
    return { aborted: true, result: promptAborted('User cancelled input') }
  }

  const modelParams: ModelRequestParams = {
    apiKey: params.apiKey,
    model: params.model,
    skipChatGptOAuth: params.skipChatGptOAuth,
  }
  const { model: aiSDKModel, isChatGptOAuth } =
    await getModelForRequest(modelParams)

  if (isChatGptOAuth) {
    trackEvent({
      event: AnalyticsEvent.CHATGPT_OAUTH_REQUEST,
      userId: userId ?? '',
      properties: {
        model: requestedModel,
        userInputId,
      },
      logger,
    })
  }

  return { aborted: false, aiSDKModel, isChatGptOAuth }
}
