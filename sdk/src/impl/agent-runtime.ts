import { trackEvent as trackCommonEvent } from '@savant-code/common/analytics'
import { env as clientEnvDefault } from '@savant-code/common/env'
import { getCiEnv } from '@savant-code/common/env-ci'
import { shouldTrackAnalyticsEvent } from '@savant-code/common/util/analytics-sampling'
import { success } from '@savant-code/common/util/error'

import { getWebsiteUrl } from '../constants'
import {
  addAgentStep,
  fetchAgentFromDatabase,
  finishAgentRun,
  getUserInfoFromApiKey,
  startAgentRun,
} from './database'
import { promptAiSdk, promptAiSdkStream, promptAiSdkStructured } from './llm'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { TrackEventFn } from '@savant-code/common/types/contracts/analytics'
import type { DatabaseAgentCache } from '@savant-code/common/types/contracts/database'
import type { ClientEnv } from '@savant-code/common/types/contracts/env'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { TraceWriter } from '@savant-code/common/types/contracts/trace'

const DATABASE_AGENT_CACHE_MAX_ENTRIES = 200

/** Insertion-order (FIFO) eviction so the cache can't grow without bound in
 *  long-lived processes (e.g. the savant-free chat server, which runs the agent
 *  runtime in-process). Templates are large — prompts plus handleSteps source. */
class BoundedAgentCache extends Map<string, AgentTemplate | null> {
  override set(key: string, value: AgentTemplate | null): this {
    if (!this.has(key)) {
      while (this.size >= DATABASE_AGENT_CACHE_MAX_ENTRIES) {
        const oldestKey = this.keys().next().value
        if (oldestKey === undefined) break
        this.delete(oldestKey)
      }
    }
    return super.set(key, value)
  }
}

const databaseAgentCache: DatabaseAgentCache = new BoundedAgentCache()

export function getAgentRuntimeImpl(
  params: {
    logger?: Logger
    traceWriter?: TraceWriter
    apiKey: string
    clientEnv?: ClientEnv
  } & Pick<
    AgentRuntimeScopedDeps,
    | 'handleStepsLogChunk'
    | 'requestToolCall'
    | 'requestMcpToolData'
    | 'requestFiles'
    | 'requestOptionalFile'
    | 'sendAction'
    | 'sendSubagentChunk'
    | 'checkpointDir'
    | 'checkpointTurnId'
  >,
): AgentRuntimeDeps & AgentRuntimeScopedDeps {
  const {
    logger,
    traceWriter,
    apiKey,
    clientEnv: clientEnvInput,
    handleStepsLogChunk,
    requestToolCall,
    requestMcpToolData,
    requestFiles,
    requestOptionalFile,
    sendAction,
    sendSubagentChunk,
    checkpointDir,
    checkpointTurnId,
  } = params

  const clientEnv: ClientEnv = {
    ...(clientEnvInput ?? clientEnvDefault),
    NEXT_PUBLIC_SAVANT_CODE_APP_URL: getWebsiteUrl(),
  }

  const trackSdkRuntimeEvent: TrackEventFn = (eventParams) => {
    if (
      clientEnv.NEXT_PUBLIC_CB_ENVIRONMENT === 'prod' &&
      !shouldTrackAnalyticsEvent({
        event: eventParams.event,
        distinctId: eventParams.userId,
        properties: eventParams.properties,
      })
    ) {
      return
    }

    trackCommonEvent(eventParams)
  }

  return {
    // Environment
    clientEnv,
    ciEnv: getCiEnv(),

    // Database
    getUserInfoFromApiKey,
    fetchAgentFromDatabase,
    startAgentRun,
    finishAgentRun,
    addAgentStep,

    // Billing
    consumeCreditsWithFallback: async () =>
      success({
        chargedToOrganization: false,
      }),

    // LLM
    promptAiSdkStream,
    promptAiSdk,
    promptAiSdkStructured,

    // Mutable State
    databaseAgentCache,

    // Analytics
    trackEvent: trackSdkRuntimeEvent,

    // Other
    logger: logger ?? noopLogger,
    traceWriter,
    fetch: globalThis.fetch,

    // Client (WebSocket)
    handleStepsLogChunk,
    requestToolCall,
    requestMcpToolData,
    requestFiles,
    requestOptionalFile,
    sendAction,
    sendSubagentChunk,

    apiKey,

    // Checkpointing (FID-2026-0803-004)
    checkpointDir,
    checkpointTurnId,
  }
}

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}
