import type { AgentTemplate } from '../../templates/types'
import type { processStreamWithTools } from '../../tool-stream-parser'
import type { ExecuteToolCallParams } from '../tool-executor'
import type { Logger as RuntimeLogger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { Subgoal } from '@savant-code/common/types/session-state'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@savant-code/common/util/file'

/** Params of `processStream` (FID-2026-0819-005 Loop 299: extracted verbatim
 *  from `tools/stream-parser.ts` so the orchestrator stays under the ceiling). */
export type ProcessStreamParams = {
  agentContext: Record<string, Subgoal>
  agentTemplate: AgentTemplate
  ancestorRunIds: string[]
  fileContext: ProjectFileContext
  fingerprintId: string
  fullResponse: string
  logger: RuntimeLogger
  messages: Message[]
  repoId: string | undefined
  runId: string
  signal: AbortSignal
  userId: string | undefined
  /** FID-2026-0802-005 H8: step-built custom tool data (incl. MCP tools). */
  customToolDefinitions?: CustomToolDefinitions

  onCostCalculated: (credits: number) => Promise<void>
  onResponseChunk: (chunk: string | PrintModeEvent) => void
} & Omit<
  ExecuteToolCallParams<string>,
  | 'fileProcessingState'
  | 'fullResponse'
  | 'input'
  | 'previousToolCallFinished'
  | 'state'
  | 'toolCallId'
  | 'toolCalls'
  | 'toolCallsToAddToMessageHistory'
  | 'toolName'
  | 'toolResults'
  | 'toolResultsToAddToMessageHistory'
> &
  ParamsExcluding<
    typeof processStreamWithTools,
    'processors' | 'defaultProcessor' | 'loggerOptions' | 'executeXmlToolCall'
  >
