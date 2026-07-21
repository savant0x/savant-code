import type { AgentTemplate } from './templates/types'
import type { OpenRouterProviderOptions } from '@savant-code/common/types/agent-template'
import type { TrackEventFn } from '@savant-code/common/types/contracts/analytics'
import type { SendActionFn } from '@savant-code/common/types/contracts/client'
import type {
  CacheDebugUsageData,
  PromptAiSdkStreamFn,
} from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ToolSet } from 'ai'

export const getAgentStreamFromTemplate = (params: {
  agentId?: string
  apiKey: string
  clientSessionId: string
  extraSavantCodeMetadata?: Record<string, string>
  fingerprintId: string
  includeCacheControl?: boolean
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  messages: Message[]
  runId: string
  signal: AbortSignal
  template: AgentTemplate
  tools: ToolSet
  userId: string | undefined
  userInputId: string
  cacheDebugCorrelation?: string
  onCacheDebugProviderRequestBuilt?: (params: {
    provider: string
    rawBody: JSONValue
    normalizedBody?: JSONValue
  }) => void
  onCacheDebugUsageReceived?: (usage: CacheDebugUsageData) => void

  onCostCalculated?: (credits: number) => Promise<void>
  promptAiSdkStream: PromptAiSdkStreamFn
  sendAction: SendActionFn
  trackEvent: TrackEventFn
}): ReturnType<PromptAiSdkStreamFn> => {
  const {
    agentId,
    apiKey,
    clientSessionId,
    extraSavantCodeMetadata,
    fingerprintId,
    includeCacheControl,
    localAgentTemplates,
    logger,
    messages,
    runId,
    template,
    tools,
    userId,
    userInputId,
    cacheDebugCorrelation,
    onCacheDebugProviderRequestBuilt,
    onCacheDebugUsageReceived,

    sendAction,
    onCostCalculated,
    promptAiSdkStream,
    trackEvent,
  } = params

  if (!template) {
    throw new Error('Agent template is null/undefined')
  }

  const { model } = template

  const aiSdkStreamParams: ParamsOf<PromptAiSdkStreamFn> = {
    agentId,
    apiKey,
    clientSessionId,
    extraSavantCodeMetadata,
    fingerprintId,
    includeCacheControl,
    logger,
    localAgentTemplates,
    maxOutputTokens: undefined,
    maxRetries: 3,
    messages,
    model,
    runId,
    signal: params.signal,
    spawnableAgents: template.spawnableAgents,
    tools,
    userId,
    userInputId,
    cacheDebugCorrelation,
    onCacheDebugProviderRequestBuilt,
    onCacheDebugUsageReceived,

    onCostCalculated,
    sendAction,
    trackEvent,
  }

  if (!aiSdkStreamParams.providerOptions) {
    aiSdkStreamParams.providerOptions = {}
  }
  for (const provider of ['openrouter', 'savant-code'] as const) {
    if (!aiSdkStreamParams.providerOptions[provider]) {
      aiSdkStreamParams.providerOptions[provider] = {}
    }
    ;(
      aiSdkStreamParams.providerOptions[provider] as OpenRouterProviderOptions
    ).reasoning = template.reasoningOptions
  }

  // Pass agent's provider routing options to SDK
  aiSdkStreamParams.agentProviderOptions = template.providerOptions

  return promptAiSdkStream(aiSdkStreamParams)
}
