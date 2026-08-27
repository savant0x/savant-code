import { systemMessage } from '@savant-code/common/util/messages'

import { CACHE_DEBUG_FULL_LOGGING } from '../constants'
import {
  createCacheDebugSnapshot,
  enrichCacheDebugSnapshotWithProviderRequest,
  enrichCacheDebugSnapshotWithUsage,
  loadCacheDebugSnapshotHashPair,
} from '../util/cache-debug'
import {
  CacheHitRateMonitor,
  estimateCostUsd,
  isCachedTokenCountKnown,
  recordAgentTurn,
} from '../util/token-telemetry'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { CacheDebugUsageData } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ToolSet } from 'ai'

export type CacheDebugHooks = {
  onCacheDebugProviderRequestBuilt?: (params: {
    provider: string
    rawBody: JSONValue
    normalizedBody?: JSONValue
  }) => void
  onCacheDebugUsageReceived?: (usage: CacheDebugUsageData) => void
}

export type CacheDebugSetup = {
  cacheDebugCorrelation: ReturnType<typeof createCacheDebugSnapshot> | undefined
  /** P4b (FID-2026-0806-003): cache-hit-rate monitor fed by the usage hook. */
  cacheHitMonitor: CacheHitRateMonitor
} & CacheDebugHooks

/**
 * Builds the cache-debug correlation snapshot and its enrichment hooks for a
 * step. Only active when CACHE_DEBUG_FULL_LOGGING is set; failures degrade to
 * no correlation rather than breaking the step.
 */
export function createCacheDebugSetup(params: {
  agentType: string
  system: string
  tools?: ToolSet
  logger: Logger
  projectRoot: string
  runId: string | undefined
  userInputId: string
  agentStepId: string
  model: AgentTemplate['model'] | undefined
  messageHistory: Message[]
  /**
   * FID-2026-0821-001 P2-1: always-on provider-usage sink — fires for every
   * stream finalize regardless of CACHE_DEBUG_FULL_LOGGING. The caller
   * stamps `agentState.lastProviderUsage` here so the reconcile path can
   * prefer provider truth over the local estimator.
   */
  onUsage?: (usage: CacheDebugUsageData) => void
}): CacheDebugSetup {
  const {
    agentType,
    system,
    tools,
    logger,
    projectRoot,
    runId,
    userInputId,
    agentStepId,
    model,
    messageHistory,
    onUsage,
  } = params

  let cacheDebugCorrelation:
    ReturnType<typeof createCacheDebugSnapshot> | undefined
  if (CACHE_DEBUG_FULL_LOGGING) {
    try {
      cacheDebugCorrelation = createCacheDebugSnapshot({
        agentType: String(agentType),
        system,
        toolDefinitions: (tools
          ? Object.fromEntries(
              Object.entries(tools).map(([name, tool]) => [
                name,
                {
                  description: tool.description,
                  inputSchema: tool.inputSchema as unknown as Record<
                    string,
                    JSONValue
                  >,
                },
              ]),
            )
          : {}) as Record<string, JSONValue>,
        messages: [systemMessage(system), ...messageHistory],
        logger,
        projectRoot,
        runId,
        userInputId,
        agentStepId,
        model,
      })
    } catch (err) {
      logger.warn({ error: err }, '[Cache Debug] Failed to create snapshot')
    }
  }

  const onCacheDebugProviderRequestBuilt = cacheDebugCorrelation
    ? ({
        provider,
        rawBody,
        normalizedBody,
      }: {
        provider: string
        rawBody: JSONValue
        normalizedBody?: JSONValue
      }) => {
        enrichCacheDebugSnapshotWithProviderRequest({
          correlation: cacheDebugCorrelation,
          provider,
          rawBody,
          normalized: normalizedBody ?? rawBody,
          logger,
        })
      }
    : undefined

  // P4b (FID-2026-0806-003): one monitor per step-setup; it receives the same
  // usage stream as the cache-debug snapshot enrichment below.
  const cacheHitMonitor = new CacheHitRateMonitor({ logger })
  // P4b prefix-stability: the cache-debug snapshot records systemHash /
  // toolsHash; feed them to the monitor so a mid-run hash-pair change (the
  // signature of a prefix-stability regression) is caught even when the
  // provider reports no cached-token counts (R3 fallback).
  if (cacheDebugCorrelation) {
    try {
      cacheHitMonitor.onPrefixStability(
        loadCacheDebugSnapshotHashPair(cacheDebugCorrelation),
      )
    } catch {
      // best-effort — hash stability is an enrichment, never a hard path
    }
  }

  // FID-2026-0821-001 P2-1: the usage callback is now ALWAYS defined — the
  // reconcile path (agentState.lastProviderUsage stamp via `onUsage`) must
  // fire in every run, not only under CACHE_DEBUG_FULL_LOGGING.
  // Correlation-gated internals preserve the previous behavior exactly when
  // the snapshot is absent.
  const onCacheDebugUsageReceived = (usage: CacheDebugUsageData) => {
    onUsage?.(usage)
    if (!cacheDebugCorrelation) return
    enrichCacheDebugSnapshotWithUsage({
      correlation: cacheDebugCorrelation,
      usage,
      logger,
    })
    // P4a/P4b (FID-2026-0806-003): emit the TokenUsageEvent from the
    // EXISTING usage hook (R2 — extend, don't duplicate) and feed the
    // cache-hit monitor.
    cacheHitMonitor.onUsage(usage)
    recordAgentTurn(
      {
        agentId: String(agentType),
        phase: 'agent_step',
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
        cachedTokens: isCachedTokenCountKnown(usage)
          ? usage.cachedInputTokens
          : null,
        estimatedCostUsd: estimateCostUsd(
          usage.inputTokens,
          usage.outputTokens,
          isCachedTokenCountKnown(usage) ? usage.cachedInputTokens : 0,
        ),
      },
      logger,
    )
  }

  return {
    cacheDebugCorrelation,
    cacheHitMonitor,
    onCacheDebugProviderRequestBuilt,
    onCacheDebugUsageReceived,
  }
}
