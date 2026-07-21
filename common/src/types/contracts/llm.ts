/* eslint-disable @typescript-eslint/no-explicit-any -- contract type: dynamic stream/error shapes */
import type { TrackEventFn } from './analytics'
import type { SendActionFn } from './client'
import type { PromptResult } from '../../util/error'
import type { OpenRouterProviderRoutingOptions , AgentTemplate } from '../agent-template'
import type { ParamsExcluding } from '../function-params'
import type { JSONValue } from '../json'
import type { Logger } from './logger'
import type { Model } from '../../old-constants'
import type { Message } from '../messages/savant-code-message'
import type { generateText, streamText, ToolCallPart } from 'ai'
import type z from 'zod/v4'

export type StreamChunk =
  | {
      type: 'text'
      text: string
      agentId?: string
    }
  | {
      type: 'reasoning'
      text: string
    }
  | Pick<
      ToolCallPart,
      'type' | 'toolCallId' | 'toolName' | 'input' | 'providerOptions'
    >
  | { type: 'error'; message: string }

export type CacheDebugUsageData = {
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  totalTokens: number
}

export type PromptAiSdkStreamFn = (
  params: {
    apiKey: string
    runId: string
    messages: Message[]
    clientSessionId: string
    fingerprintId: string
    model: Model
    userId: string | undefined
    chargeUser?: boolean
    thinkingBudget?: number
    userInputId: string
    agentId?: string
    maxRetries?: number
    onCostCalculated?: (credits: number) => Promise<void>
    onCacheDebugProviderRequestBuilt?: (params: {
      provider: string
      rawBody: JSONValue
      normalizedBody?: JSONValue
    }) => void
    onCacheDebugUsageReceived?: (usage: CacheDebugUsageData) => void
    includeCacheControl?: boolean
    cacheDebugCorrelation?: string
    agentProviderOptions?: OpenRouterProviderRoutingOptions
    /** List of agents that can be spawned - used to transform agent tool calls */
    spawnableAgents?: string[]
    /** Map of locally available agent templates - used to transform agent tool calls */
    localAgentTemplates?: Record<string, AgentTemplate>
    /** Extra key/values merged into the request's `savant_code_metadata` field.
     *  Used to forward client-scoped identifiers (e.g. `freebuff_instance_id`)
     *  that server-side gates read from the chat-completions body. */
    extraSavantCodeMetadata?: Record<string, string>
    sendAction: SendActionFn
    logger: Logger
    trackEvent: TrackEventFn
    signal: AbortSignal
  } & ParamsExcluding<typeof streamText, 'model' | 'messages'>,
) => AsyncGenerator<StreamChunk, PromptResult<string | null>>

export type PromptAiSdkFn = (
  params: {
    apiKey: string
    runId: string
    messages: Message[]
    clientSessionId: string
    fingerprintId: string
    userInputId: string
    model: Model
    userId: string | undefined
    chargeUser?: boolean
    agentId?: string
    onCostCalculated?: (credits: number) => Promise<void>
    onCacheDebugProviderRequestBuilt?: (params: {
      provider: string
      rawBody: JSONValue
      normalizedBody?: JSONValue
    }) => void
    onCacheDebugUsageReceived?: (usage: CacheDebugUsageData) => void
    includeCacheControl?: boolean
    cacheDebugCorrelation?: string
    agentProviderOptions?: OpenRouterProviderRoutingOptions
    maxRetries?: number
    sendAction: SendActionFn
    logger: Logger
    trackEvent: TrackEventFn
    n?: number
    signal: AbortSignal
  } & ParamsExcluding<typeof generateText, 'model' | 'messages'>,
) => Promise<PromptResult<string>>

export type PromptAiSdkStructuredInput<T> = {
  apiKey: string
  runId: string
  messages: Message[]
  schema: z.ZodType<T>
  clientSessionId: string
  fingerprintId: string
  userInputId: string
  model: Model
  userId: string | undefined
  maxTokens?: number
  temperature?: number
  timeout?: number
  chargeUser?: boolean
  agentId?: string
    onCostCalculated?: (credits: number) => Promise<void>
    onCacheDebugProviderRequestBuilt?: (params: {
      provider: string
      rawBody: JSONValue
      normalizedBody?: JSONValue
    }) => void
  onCacheDebugUsageReceived?: (usage: CacheDebugUsageData) => void
  includeCacheControl?: boolean
  cacheDebugCorrelation?: string
  agentProviderOptions?: OpenRouterProviderRoutingOptions
  maxRetries?: number
  sendAction: SendActionFn
  logger: Logger
  trackEvent: TrackEventFn
  signal: AbortSignal
}
export type PromptAiSdkStructuredOutput<T> = Promise<PromptResult<T>>
export type PromptAiSdkStructuredFn = <T>(
  params: PromptAiSdkStructuredInput<T>,
) => PromptAiSdkStructuredOutput<T>

export type HandleOpenRouterStreamFn = (params: {
  body: any
  userId: string
  agentId: string
}) => Promise<ReadableStream>
