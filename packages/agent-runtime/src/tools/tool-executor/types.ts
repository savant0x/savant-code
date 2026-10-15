import type { AgentTemplate } from '../../templates/types'
import type { FileProcessingState } from '../handlers/tool/write-file'
import type { CustomToolCall } from '../tool-call-parse'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { TraceWriter } from '@savant-code/common/types/contracts/trace'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type {
  AgentState,
  Subgoal,
} from '@savant-code/common/types/session-state'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

export type ExecuteToolCallParams<T extends string = ToolName> = {
  toolName: T
  input: Record<string, JSONValue>
  autoInsertEndStepParam?: boolean
  excludeToolFromMessageHistory?: boolean

  agentContext: Record<string, Subgoal>
  agentState: AgentState
  agentStepId: string
  ancestorRunIds: string[]
  agentTemplate: AgentTemplate
  clientSessionId: string
  fileContext: ProjectFileContext
  fileProcessingState: FileProcessingState
  fingerprintId: string
  fullResponse: string
  localAgentTemplates: Record<string, AgentTemplate>
  /** FID-2026-0909-008 Step 4: the run's resolved output budget, threaded so
   *  spawn handlers can propagate it to child agent loops (the same value
   *  the stream call site forwards). */
  maxOutputTokens?: number
  logger: Logger
  previousToolCallFinished: Promise<void>
  prompt: string | undefined
  repoId: string | undefined
  repoUrl: string | undefined
  runId: string
  signal: AbortSignal
  system: string
  tools: ToolSet
  toolCallId: string | undefined
  toolCalls: (SavantCodeToolCall | CustomToolCall)[]
  toolCallsToAddToMessageHistory: (SavantCodeToolCall | CustomToolCall)[]
  toolResults: ToolMessage[]
  toolResultsToAddToMessageHistory: ToolMessage[]
  userId: string | undefined
  userInputId: string
  traceWriter?: TraceWriter
  /** FID-2026-0802-005 H8: step-built custom tool data (incl. MCP tools). When
   *  provided, executeCustomToolCall skips the per-call getMCPToolData rebuild. */
  customToolDefinitions?: CustomToolDefinitions

  fetch: typeof globalThis.fetch
  onCostCalculated: (credits: number) => Promise<void>
  onResponseChunk: (chunk: string | PrintModeEvent) => void
} & AgentRuntimeDeps &
  AgentRuntimeScopedDeps
