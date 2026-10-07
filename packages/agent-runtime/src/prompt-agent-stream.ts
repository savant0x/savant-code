import { recordModelAvailability } from '@savant-code/common/providers/availability-state'
import { classifyAvailabilityObservation } from '@savant-code/common/providers/availability-verdict'

import { explicitModelRejection } from './provider-boundary/availability-observation'
import { runWithClassifiedRetry } from './provider-boundary/classified-stream-retry'
import { ClassifiedProviderError } from './provider-boundary/failure-class'
import { providerCircuitBreakerFor } from './provider-boundary/provider-circuit-breaker'
import { resolveRetryPolicy } from './provider-boundary/retry-policy'
import { accumulateChunk } from './stream-recovery/outcome'
import { runTurnWithRecovery } from './stream-recovery/recovery-executor'
import { countTokens } from './util/token-counter'

import type { ProviderCircuitBreaker } from './provider-boundary/provider-circuit-breaker'
import type { StreamCloseKind } from './stream-recovery/outcome'
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
import type { CacheBreakpointTtl } from '@savant-code/common/util/messages'
import type { ToolSet } from 'ai'

export const getAgentStreamFromTemplate = (params: {
  agentId?: string
  clientSessionId: string
  extraSavantCodeMetadata?: Record<string, string>
  fingerprintId: string
  includeCacheControl?: boolean
  /** FID-2026-1006-005 step 7: the run's resolved cache-breakpoint TTL,
   *  forwarded to the SDK verbatim so the breakpoint bytes carry it. */
  cacheBreakpointTtl?: CacheBreakpointTtl
  localAgentTemplates: Record<string, AgentTemplate>
  /** FID-2026-0909-008 Step 4: the run's resolved output budget
   *  (max_completion_tokens from the model catalog). Forwarded to the SDK
   *  stream so requests carry an explicit, model-appropriate max_tokens —
   *  an unset budget let provider defaults truncate large native tool calls
   *  mid-JSON. Absent → undefined → the field is omitted from the request
   *  and the provider default governs. */
  maxOutputTokens?: number
  contextWindow?: number
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
  /** FID-2026-1005-006: validated at call time (throws on shape mismatch). */
  retryPolicy?: unknown
  /** Per-provider breaker for retry suppression; user calls always proceed. */
  circuitBreaker?: ProviderCircuitBreaker
  promptAiSdkStream: PromptAiSdkStreamFn
  sendAction: SendActionFn
  trackEvent: TrackEventFn
}): ReturnType<PromptAiSdkStreamFn> => {
  const {
    agentId,
    clientSessionId,
    extraSavantCodeMetadata,
    fingerprintId,
    includeCacheControl,
    cacheBreakpointTtl,
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
    clientSessionId,
    extraSavantCodeMetadata,
    fingerprintId,
    includeCacheControl,
    cacheBreakpointTtl,
    logger,
    localAgentTemplates,
    maxOutputTokens: params.maxOutputTokens,
    contextWindow: params.contextWindow,
    // FID-2026-1005-006: the classified boundary owns retries (see below),
    // so the client's blind retry is disabled — never a uniform 3.
    maxRetries: 0,
    messages,
    model,
    modelRoute: template.modelRoute,
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

  // FID-2026-1005-006: the policy is validated EAGERLY — a malformed shape
  // fails at call time, loudly, before any request can observe a delay.
  const policy = resolveRetryPolicy(params.retryPolicy)
  const route = template.modelRoute
  const connectionKey = route
    ? `${route.providerId}:${route.authMode}:${route.configRevision ?? ''}:${route.accountRevision ?? ''}`
    : `legacy:${clientSessionId}`
  const breaker =
    params.circuitBreaker ?? providerCircuitBreakerFor(connectionKey)
  const availabilityCallbacks = route
    ? {
        onSuccess: () =>
          recordModelAvailability(
            route.providerId,
            model,
            classifyAvailabilityObservation({
              bodyDecoded: true,
              httpStatus: 200,
              observedAt: Date.now(),
            }),
          ),
        onFailure: (verdict: { reason: string }, cause: unknown) => {
          if (verdict.reason !== 'model-unavailable') return
          const reason = explicitModelRejection(cause)
          if (reason)
            recordModelAvailability(
              route.providerId,
              model,
              classifyAvailabilityObservation({
                bodyDecoded: true,
                rejected: { reason },
                observedAt: Date.now(),
              }),
            )
        },
      }
    : {}
  const startedAt = Date.now()
  let physicalRequests = 0
  const createPhysical = (request: ParamsOf<PromptAiSdkStreamFn>) => {
    physicalRequests += 1
    return promptAiSdkStream(request)
  }

  // Classify-then-decide at the boundary: the breaker receives every
  // classified outcome without blocking a user attempt.
  // Only zero-emission transient failures retry (429 at most once per turn).
  const classifiedTurn = () =>
    runWithClassifiedRetry({
      policy: { ...policy, maxAttempts: Math.min(policy.maxAttempts, 2) },
      breaker,
      ...availabilityCallbacks,
      create: () => createPhysical(aiSdkStreamParams),
      onUnknownShape: (message) =>
        logger.warn({ boundary: 'failure-class' }, message),
    })

  // FID-2026-1005-007: bounded stream recovery — exactly one recovery
  // request for the reasoning-only truncation shape (checkpoint-seeded,
  // tools disabled, hard budgets, physical/logical accounting).
  return runTurnWithRecovery({
    logicalTurnId: `${params.runId}:${params.userInputId}`,
    originalInput: lastUserInput(params.messages),
    create: classifiedTurn,
    createRecovery: (request) =>
      runWithClassifiedRetry({
        policy: { ...policy, maxAttempts: 1 },
        breaker,
        ...availabilityCallbacks,
        create: () =>
          createPhysical({
            ...aiSdkStreamParams,
            signal: AbortSignal.any([
              params.signal,
              AbortSignal.timeout(request.segmentBudgetMs),
            ]),
            tools: {},
            maxOutputTokens: request.outputCapTokens,
            messages: [
              ...aiSdkStreamParams.messages,
              {
                role: 'user',
                content: [{ type: 'text', text: request.prompt }],
              },
            ],
          }),
      }),
    observeChunk: (turn, chunk) => accumulateChunk(turn, chunk),
    closeKindOf: (error: unknown): StreamCloseKind => {
      if (params.signal.aborted) return 'cancel'
      if (error instanceof ClassifiedProviderError) {
        if (error.cause instanceof Error && error.cause.name === 'AbortError')
          return 'cancel'
        return error.verdict.class === 'transient' ? 'thrown' : 'error'
      }
      return error instanceof Error && error.name === 'AbortError'
        ? 'cancel'
        : 'thrown'
    },
    onAccounting: (record) =>
      logger.info(
        {
          logicalTurnId: record.logicalTurnId,
          physicalRequestIndex: record.physicalRequestIndex,
          recovered: record.recovered,
          outcome: record.outcome,
        },
        'stream recovery accounting (physical requests vs logical turn)',
      ),
    // Conservative headroom: without a resolved output budget there is no
    // proven headroom, so recovery stays off (the plan refuses to run).
    canRecover: () => physicalRequests < 2,
    physicalRequestCount: () => physicalRequests,
    budget: (turn) => ({
      elapsedMs: Date.now() - startedAt,
      remainingTokenBudget: Math.min(
        params.maxOutputTokens ?? 0,
        Math.max(
          0,
          (params.contextWindow ?? 0) -
            countTokens(JSON.stringify(aiSdkStreamParams.messages)) -
            Math.ceil(turn.reasoning.length / 3),
        ),
      ),
    }),
  })
}

/** The turn's last user text — the recovery request's original input. */
function lastUserInput(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message?.role !== 'user') continue
    const text = message.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
    if (text) return text
  }
  return ''
}
