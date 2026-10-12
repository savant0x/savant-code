import type { TrackEventFn } from './analytics'
import type { SendActionFn } from './client'
import type { Model } from '../../old-constants'
import type { ModelRoute } from '../../providers/model-route'
import type { PromptResult } from '../../util/error'
import type {
  OpenRouterProviderRoutingOptions,
  AgentTemplate,
} from '../agent-template'
import type { ParamsExcluding } from '../function-params'
import type { JSONValue } from '../json'
import type { Logger } from './logger'
import type { CacheBreakpointTtl } from '../../util/messages/cache-control'
import type { Message } from '../messages/savant-code-message'
import type { generateText, streamText, ToolCallPart } from 'ai'
import type z from 'zod/v4'

/**
 * A tool name the request never declared (FID-2026-1012-002).
 *
 * The completeness predicate asks whether a call is executable; this is the
 * different condition "the model named a tool that was not offered", which no
 * amount of payload splitting or retrying can satisfy. Kept as its own error
 * class so the runtime can steer and budget it differently from a genuine
 * mid-JSON truncation.
 */
export type UnavailableToolError = {
  type: 'tool-unavailable'
  toolName: string
}

export function isUnavailableToolError(
  value: object,
): value is UnavailableToolError {
  if (!('type' in value) || !('toolName' in value)) {
    return false
  }
  const candidate = value as { type: string; toolName: string }
  return (
    candidate.type === 'tool-unavailable' &&
    typeof candidate.toolName === 'string'
  )
}

export type NativeToolCallError = {
  type: 'native-incomplete'
  toolName: string
  /** The provider's mapped finish reason at flush time — 'length' marks an
   *  output-cap hit that cut the arguments mid-stream (FID-2026-0909-008).
   *  Present only when the provider actually sent a finish reason. */
  finishReason?: string
}

export function isNativeToolCallError(
  value: object,
): value is NativeToolCallError {
  if (!('type' in value) || !('toolName' in value)) {
    return false
  }

  // FID-2026-0909-008: finishReason is optional, but a hostile provider
  // must not be able to smuggle a non-string through the guard.
  if ('finishReason' in value && typeof value.finishReason !== 'string') {
    return false
  }
  const candidate = value as {
    type: string
    toolName: string
  }
  return (
    candidate.type === 'native-incomplete' &&
    typeof candidate.toolName === 'string'
  )
}

export type StreamErrorChunk =
  | {
      type: 'error'
      message: string
    }
  | {
      type: 'error'
      message: string
      errorClass: 'native-incomplete'
      toolName: string
      /** Provider finish reason carried through from the native error
       *  ('length' = output-cap hit). See NativeToolCallError. */
      finishReason?: string
    }
  | {
      type: 'error'
      message: string
      /** FID-2026-1012-002: the model named a tool this request never
       *  declared. Distinct from `native-incomplete` because the recovery
       *  action differs — name the available tools, do not advise a smaller
       *  payload. */
      errorClass: 'tool-unavailable'
      toolName: string
    }

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
  | StreamErrorChunk

export type CacheDebugUsageData = {
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  totalTokens: number
  /**
   * FID-2026-1007-009: whether the provider actually reported a cached-token
   * count. `cachedInputTokens` is coerced to 0 for shape stability, so without
   * this flag an omitted field and a reported zero are indistinguishable — and
   * a provider that does not report caching must never be rendered as a cache
   * miss. Absent means "unknown to the emitter", which the consumer resolves
   * with the legacy R3 rule (see `isCachedTokenCountKnown`).
   */
  cachedInputTokensReported?: boolean
}

/**
 * FID-2026-1009-003 L2: overflow seam. Invoked when a request's input
 * estimate leaves no output headroom within the context window — before
 * the SDK trims the prompt and retries once. Hosts may compact their
 * shared session state here (the next step benefits); a throwing seam is
 * logged and never blocks the trim recovery.
 */
export type OnContextOverflow = (info: {
  inputTokens: number
  contextWindow: number
}) => void | Promise<void>

export type PromptAiSdkStreamFn = (
  params: {
    runId: string
    messages: Message[]
    clientSessionId: string
    fingerprintId: string
    model: Model
    modelRoute?: ModelRoute
    contextWindow?: number
    /** FID-2026-1009-003 L2: overflow seam — see OnContextOverflow. */
    onContextOverflow?: OnContextOverflow
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
    /** FID-2026-1006-005 step 7: breakpoint TTL for this request, resolved from
     *  the run's enforcement mode. Absent = the provider's own default (5m). */
    cacheBreakpointTtl?: CacheBreakpointTtl
    cacheDebugCorrelation?: string
    agentProviderOptions?: OpenRouterProviderRoutingOptions
    /** List of agents that can be spawned - used to transform agent tool calls */
    spawnableAgents?: string[]
    /** Map of locally available agent templates - used to transform agent tool calls */
    localAgentTemplates?: Record<string, AgentTemplate>
    /** Extra key/values merged into the request's `savant_code_metadata` field.
     *  Used to forward client-scoped identifiers (e.g. `savant_free_instance_id`)
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
    runId: string
    messages: Message[]
    clientSessionId: string
    fingerprintId: string
    userInputId: string
    model: Model
    modelRoute?: ModelRoute
    contextWindow?: number
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
    /** FID-2026-1006-005 step 7: breakpoint TTL for this request, resolved from
     *  the run's enforcement mode. Absent = the provider's own default (5m). */
    cacheBreakpointTtl?: CacheBreakpointTtl
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
  runId: string
  messages: Message[]
  schema: z.ZodType<T>
  clientSessionId: string
  fingerprintId: string
  userInputId: string
  model: Model
  modelRoute?: ModelRoute
  contextWindow?: number
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
  body: ReadableStream<Uint8Array> | null
  userId: string
  agentId: string
}) => Promise<ReadableStream<Uint8Array>>
