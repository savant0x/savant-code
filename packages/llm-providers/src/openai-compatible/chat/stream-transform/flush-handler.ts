import { isCompleteKnownToolCallArguments } from './tool-arguments'

import type { ChatStreamTransformerState } from './state'
import type { StreamExtractor } from './types'
import type {
  LanguageModelV2StreamPart,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider'

export function flushStream(params: {
  controller: TransformStreamDefaultController<LanguageModelV2StreamPart>
  state: ChatStreamTransformerState
  metadataExtractor?: StreamExtractor
  providerOptionsName: string
  requiredToolKeys: ReadonlyMap<string, readonly string[]>
}): void {
  const {
    controller,
    state,
    metadataExtractor,
    providerOptionsName,
    requiredToolKeys,
  } = params
  if (state.isActiveReasoning) {
    controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' })
  }

  if (state.isActiveText) {
    controller.enqueue({ type: 'text-end', id: 'txt-0' })
  }

  // Go through all tool calls and close each input lifecycle exactly
  // once. Never emit a malformed or schema-incomplete candidate as an
  // executable tool-call.
  for (const toolCall of state.toolCalls.filter(
    (toolCall) => !toolCall.hasFinished,
  )) {
    controller.enqueue({
      type: 'tool-input-end',
      id: toolCall.id,
    })

    if (
      isCompleteKnownToolCallArguments(
        toolCall.function.arguments,
        toolCall.function.name,
        requiredToolKeys,
      )
    ) {
      controller.enqueue({
        type: 'tool-call',
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        input: toolCall.function.arguments,
      })
    } else {
      // FID-2026-0909-008: mark the flush failure without overwriting
      // the provider's finish reason. The original reason (e.g. 'length'
      // for an output-cap hit) is carried on the error chunk so
      // downstream steering can distinguish a cap hit — which needs a
      // split-payload recovery — from a malformed emission, where a
      // straight retry is safe.
      state.hadIncompleteToolCall = true
      controller.enqueue({
        type: 'error',
        error: {
          type: 'native-incomplete',
          toolName: toolCall.function.name,
          ...(state.finishReason !== 'unknown' && {
            finishReason: state.finishReason,
          }),
        },
      })
    }
  }

  const providerMetadata: SharedV2ProviderMetadata = {
    [providerOptionsName]: {},
    ...metadataExtractor?.buildMetadata(),
  }
  if (state.usage.completionTokensDetails.acceptedPredictionTokens != null) {
    providerMetadata[providerOptionsName].acceptedPredictionTokens =
      state.usage.completionTokensDetails.acceptedPredictionTokens
  }
  if (state.usage.completionTokensDetails.rejectedPredictionTokens != null) {
    providerMetadata[providerOptionsName].rejectedPredictionTokens =
      state.usage.completionTokensDetails.rejectedPredictionTokens
  }

  controller.enqueue({
    type: 'finish',
    finishReason: state.finishReason,
    usage: {
      inputTokens: state.usage.promptTokens ?? undefined,
      outputTokens: state.usage.completionTokens ?? undefined,
      totalTokens: state.usage.totalTokens ?? undefined,
      reasoningTokens:
        state.usage.completionTokensDetails.reasoningTokens ?? undefined,
      cachedInputTokens:
        state.usage.promptTokensDetails.cachedTokens ?? undefined,
    },
    providerMetadata,
  })
}
