import { trackEvent as trackCommonEvent } from '@savant-code/common/analytics'
import { env as clientEnvDefault } from '@savant-code/common/env'
import { getCiEnv } from '@savant-code/common/env-ci'
import { shouldTrackAnalyticsEvent } from '@savant-code/common/util/analytics-sampling'
import { success } from '@savant-code/common/util/error'

import { promptAiSdk, promptAiSdkStream, promptAiSdkStructured } from './llm'

import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { TrackEventFn } from '@savant-code/common/types/contracts/analytics'
import type { ClientEnv } from '@savant-code/common/types/contracts/env'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { TraceWriter } from '@savant-code/common/types/contracts/trace'

export function getAgentRuntimeImpl(
  params: {
    logger?: Logger
    traceWriter?: TraceWriter
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
    | 'probeClientCapabilities'
  >,
): AgentRuntimeDeps & AgentRuntimeScopedDeps {
  const {
    logger,
    traceWriter,
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
    probeClientCapabilities,
  } = params

  const clientEnv: ClientEnv = {
    ...(clientEnvInput ?? clientEnvDefault),
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

    // Billing
    consumeCreditsWithFallback: async () =>
      success({
        chargedToOrganization: false,
      }),

    // LLM
    promptAiSdkStream,
    promptAiSdk,
    promptAiSdkStructured,

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

    // Checkpointing (FID-2026-0803-004)
    checkpointDir,
    checkpointTurnId,
    probeClientCapabilities,
  }
}

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}
