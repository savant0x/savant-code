import type { TrackEventFn } from './analytics'
import type { ConsumeCreditsWithFallbackFn } from './billing'
import type {
  HandleStepsLogChunkFn,
  RequestFilesFn,
  RequestMcpToolDataFn,
  RequestOptionalFileFn,
  RequestToolCallFn,
  SendActionFn,
  SendSubagentChunkFn,
} from './client'
import type { ClientEnv, CiEnv } from './env'
import type {
  PromptAiSdkFn,
  PromptAiSdkStreamFn,
  PromptAiSdkStructuredFn,
} from './llm'
import type { Logger } from './logger'
import type { TraceWriter } from './trace'
import type { ProbeClientCapabilitiesFn } from '../../util/capability-notice'

/** Shared dependencies */
export type AgentRuntimeDeps = {
  // Environment
  clientEnv: ClientEnv
  ciEnv: CiEnv

  // Billing
  consumeCreditsWithFallback: ConsumeCreditsWithFallbackFn

  // LLM
  promptAiSdkStream: PromptAiSdkStreamFn
  promptAiSdk: PromptAiSdkFn
  promptAiSdkStructured: PromptAiSdkStructuredFn

  // Analytics
  trackEvent: TrackEventFn

  // Other
  logger: Logger
  /** Optional debug trace of agent message histories (see TraceWriter) */
  traceWriter?: TraceWriter
  fetch: typeof globalThis.fetch
}

/** Per-run dependencies */
export type AgentRuntimeScopedDeps = {
  // Client (WebSocket)
  handleStepsLogChunk: HandleStepsLogChunkFn
  requestToolCall: RequestToolCallFn
  requestMcpToolData: RequestMcpToolDataFn
  requestFiles: RequestFilesFn
  requestOptionalFile: RequestOptionalFileFn
  sendAction: SendActionFn
  sendSubagentChunk: SendSubagentChunkFn
  /** Local client availability, scoped to the run and requested effective tools. */
  probeClientCapabilities?: ProbeClientCapabilitiesFn

  /** FID-2026-0803-004: directory for persistent per-turn file checkpoints
   *  (rewind). When unset, checkpoint capture is disabled. Hosts that enable
   *  it also call openTurn/closeTurn on the checkpoint store around the run. */
  checkpointDir?: string
  /** FID-2026-0803-004: turn identity for checkpoint grouping. Defaults to
   *  clientSessionId; hosts may pass their own id (e.g. the CLI's aiMessageId)
   *  so subagent writes land in the same turn's checkpoint. */
  checkpointTurnId?: string
}
