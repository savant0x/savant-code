import type { getMCPToolData } from '../mcp'
import type { getAgentStreamFromTemplate } from '../prompt-agent-stream'
import type { runProgrammaticStep } from '../run-programmatic-step'
import type { RunAgentStepFn } from './step'
import type { additionalToolDefinitions } from './tool-definitions'
import type { getAgentTemplate } from '../templates/agent-registry'
import type { getAgentPrompt } from '../templates/strings'
import type { processStream } from '../tools/stream-parser'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { TrackEventFn } from '@savant-code/common/types/contracts/analytics'
import type {
  AddAgentStepFn,
  FinishAgentRunFn,
  StartAgentRunFn,
} from '@savant-code/common/types/contracts/database'
import type { PromptAiSdkFn } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { TraceWriter } from '@savant-code/common/types/contracts/trace'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  TextPart,
  ImagePart,
} from '@savant-code/common/types/messages/content-part'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type {
  AgentTemplateType,
  AgentState,
  AgentOutput,
} from '@savant-code/common/types/session-state'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

export type RunAgentStepParams = {
  userId: string | undefined
  userInputId: string
  clientSessionId: string
  fingerprintId: string
  repoId: string | undefined
  onResponseChunk: (chunk: string | PrintModeEvent) => void

  agentType: AgentTemplateType
  agentTemplate: AgentTemplate
  fileContext: ProjectFileContext
  agentState: AgentState
  localAgentTemplates: Record<string, AgentTemplate>

  prompt: string | undefined
  spawnParams: Record<string, JSONValue> | undefined
  system: string
  n?: number
  /** FID-2026-0802-005 L15: step prompt computed once per step by
   *  loopAgentSteps (token counting needs it too) and passed down — avoids
   *  a second formatPrompt pass (~13 replaceAll incl. file tree). */
  stepPrompt?: string
  /** FID-2026-0815-011 E-01: system-prompt token count computed once per step
   *  in prepareStepContext and passed down so runAgentStep does not re-tokenize
   *  the invariant system prompt. */
  systemTokens?: number
  /** FID-2026-0802-005 H8: step-built custom tool data (incl. MCP tools). */
  customToolDefinitions?: CustomToolDefinitions

  trackEvent: TrackEventFn
  promptAiSdk: PromptAiSdkFn
  traceWriter?: TraceWriter
} & ParamsExcluding<
  typeof processStream,
  | 'agentContext'
  | 'agentState'
  | 'agentStepId'
  | 'agentTemplate'
  | 'fullResponse'
  | 'messages'
  | 'onCostCalculated'
  | 'repoId'
  | 'stream'
> &
  ParamsExcluding<
    typeof getAgentStreamFromTemplate,
    | 'agentId'
    | 'includeCacheControl'
    | 'messages'
    | 'onCostCalculated'
    | 'template'
  > &
  ParamsExcluding<typeof getAgentTemplate, 'agentId'> &
  ParamsExcluding<
    typeof getAgentPrompt,
    'agentTemplate' | 'promptType' | 'agentState' | 'agentTemplates'
  > &
  ParamsExcluding<
    typeof getMCPToolData,
    'toolNames' | 'mcpServers' | 'writeTo'
  > &
  ParamsExcluding<
    PromptAiSdkFn,
    'messages' | 'model' | 'onCostCalculated' | 'n'
  >

export type RunAgentStepResult = {
  agentState: AgentState
  fullResponse: string
  shouldEndTurn: boolean
  hasNativeIncompleteToolCall: boolean
  /** FID-2026-0816-012: name of the tool whose native call was last flagged
   *  `native-incomplete`, so the exhausted-failure message can name it and
   *  the parent can re-spawn with a split-task prompt. */
  lastIncompleteToolName?: string
  messageId: string | null
  nResponses?: string[]
}

export type LoopAgentStepsParams = {
  addAgentStep: AddAgentStepFn
  agentState: AgentState
  agentType: string
  clearUserPromptMessagesAfterResponse?: boolean
  clientSessionId: string
  content?: Array<TextPart | ImagePart>
  fileContext: ProjectFileContext
  finishAgentRun: FinishAgentRunFn
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  parentSystemPrompt?: string
  parentTools?: ToolSet
  prompt: string | undefined
  signal: AbortSignal
  /** Optional steering hook. Drained at each step boundary (after a step's LLM
   * call + tools complete, before the next one). Any returned texts are appended
   * to the message history as user prompts and keep the turn going, letting a
   * host "steer" a running agent without aborting or losing the current step. */
  drainSteeringMessages?: () => string[]
  spawnParams: Record<string, JSONValue> | undefined
  startAgentRun: StartAgentRunFn
  userId: string | undefined
  userInputId: string
  agentTemplate?: AgentTemplate
  /** FID-2026-0725-085 CTX-007: Resolved context window from OpenRouter catalog. */
  contextWindow?: number
  /** FID-2026-0814-004 H-05/H-06/H-07: compression config threaded from
   *  `protocol.config.yaml` `compression`. Absent → runtime defaults. */
  compression?: {
    microCompact?: boolean
    keepRecentTokens?: number
    autoCompactRatio?: number
    forceCompactOffset?: number
    microCompactMaxKeepRecent?: number
    microCompactFloorTokens?: number
  }
} & ParamsExcluding<typeof additionalToolDefinitions, 'agentTemplate'> &
  ParamsExcluding<
    typeof runProgrammaticStep,
    | 'agentState'
    | 'onCostCalculated'
    | 'prompt'
    | 'runId'
    | 'stepNumber'
    | 'stepsComplete'
    | 'system'
    | 'template'
    | 'toolCallParams'
    | 'tools'
  > &
  ParamsExcluding<typeof getAgentTemplate, 'agentId'> &
  ParamsExcluding<
    typeof getAgentPrompt,
    | 'agentTemplate'
    | 'promptType'
    | 'agentTemplates'
    | 'additionalToolDefinitions'
  > &
  ParamsExcluding<
    typeof getMCPToolData,
    'toolNames' | 'mcpServers' | 'writeTo'
  > &
  ParamsExcluding<StartAgentRunFn, 'agentId' | 'ancestorRunIds'> &
  ParamsExcluding<
    FinishAgentRunFn,
    'runId' | 'status' | 'totalSteps' | 'directCredits' | 'totalCredits'
  > &
  ParamsExcluding<
    RunAgentStepFn,
    | 'additionalToolDefinitions'
    | 'agentState'
    | 'agentTemplate'
    | 'prompt'
    | 'runId'
    | 'spawnParams'
    | 'system'
    | 'tools'
  > &
  ParamsExcluding<
    AddAgentStepFn,
    | 'agentRunId'
    | 'stepNumber'
    | 'credits'
    | 'childRunIds'
    | 'messageId'
    | 'status'
    | 'startTime'
  >

export type LoopAgentStepsResult = {
  agentState: AgentState
  output: AgentOutput
}
