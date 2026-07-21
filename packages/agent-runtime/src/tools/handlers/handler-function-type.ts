import type { FileProcessingState } from './tool/write-file'
import type { ToolName } from '@savant-code/common/tools/constants'
import type {
  ClientToolCall,
  ClientToolName,
  SavantCodeToolCall,
  SavantCodeToolMessage,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { TrackEventFn } from '@savant-code/common/types/contracts/analytics'
import type { SendSubagentChunkFn } from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState, Subgoal } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

// Distributive conditional helper: a key is either present with value `V`
// (when the tool is a ClientToolName) or absent (otherwise). The inline
// conditional `T extends ClientToolName ? T : never` inside V keeps the
// function's parameter types narrow at concrete T sites without collapsing
// the slot to `never` for generic T (which the outer conditional pattern
// does — see FID-028 historical notes).
type PresentOrAbsent<K extends PropertyKey, V> =
  | { [P in K]: V }
  | { [P in K]: never }

export type SavantCodeToolHandlerFunction<T extends ToolName = ToolName> = (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SavantCodeToolCall<T>

    agentContext: Record<string, Subgoal>
    agentState: AgentState
    agentStepId: string
    agentTemplate: AgentTemplate
    ancestorRunIds: string[]
    apiKey: string
    clientSessionId: string
    fetch: typeof globalThis.fetch
    fileContext: ProjectFileContext
    fileProcessingState: FileProcessingState
    fingerprintId: string
    fullResponse: string
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
    prompt: string | undefined
    repoId: string | undefined
    repoUrl: string | undefined
    runId: string
    sendSubagentChunk: SendSubagentChunkFn
    signal: AbortSignal
    system: string
    tools: ToolSet
    trackEvent: TrackEventFn
    userId: string | undefined
    userInputId: string
    writeToClient: (chunk: string | PrintModeEvent) => void
  } & PresentOrAbsent<
    'requestClientToolCall',
    (
      toolCall: ClientToolCall<T extends ClientToolName ? T : never>,
    ) => Promise<SavantCodeToolOutput<T extends ClientToolName ? T : never>>
  > &
    AgentRuntimeDeps &
    AgentRuntimeScopedDeps,
) => Promise<{
  output: SavantCodeToolMessage<T>['content']
  creditsUsed?: number
}>
