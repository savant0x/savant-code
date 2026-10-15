import type { LanguageModelV2FinishReason } from '@ai-sdk/provider'

export interface ChatStreamTransformerState {
  toolCalls: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
    hasFinished: boolean
  }>
  finishReason: LanguageModelV2FinishReason
  usage: {
    completionTokens: number | undefined
    completionTokensDetails: {
      reasoningTokens: number | undefined
      acceptedPredictionTokens: number | undefined
      rejectedPredictionTokens: number | undefined
    }
    promptTokens: number | undefined
    promptTokensDetails: {
      cachedTokens: number | undefined
    }
    totalTokens: number | undefined
  }
  isFirstChunk: boolean
  isActiveReasoning: boolean
  isActiveText: boolean
}

export function createChatStreamTransformerState(): ChatStreamTransformerState {
  return {
    toolCalls: [],
    finishReason: 'unknown',
    usage: {
      completionTokens: undefined,
      completionTokensDetails: {
        reasoningTokens: undefined,
        acceptedPredictionTokens: undefined,
        rejectedPredictionTokens: undefined,
      },
      promptTokens: undefined,
      promptTokensDetails: {
        cachedTokens: undefined,
      },
      totalTokens: undefined,
    },
    isFirstChunk: true,
    isActiveReasoning: false,
    isActiveText: false,
  }
}
