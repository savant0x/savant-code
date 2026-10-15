import { fireNotificationHook } from '../../../hooks/lifecycle-hooks'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

type ToolName = 'ask_user'

// Handler for ask_user - delegates to client
export const handleAskUser = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<ToolName>
  requestClientToolCall: (
    toolCall: SavantCodeToolCall<ToolName>,
  ) => Promise<SavantCodeToolOutput<ToolName>>
  // FID-2026-0919-031: REQUIRED, not optional. The dispatcher passes the full
  // tool-handler params object (`...params` in tool-executor/native.ts), so a
  // caller that omits these is a type error — where an optional pair would make
  // the `Notification` hook below silently unreachable, the exact
  // silent-inertness failure FID-2026-0919-030 classified and this FID wires.
  agentState: AgentState
  fileContext: ProjectFileContext
}): Promise<{ output: SavantCodeToolOutput<ToolName> }> => {
  const { previousToolCallFinished, toolCall, requestClientToolCall } = params

  await previousToolCallFinished

  // FID-2026-0919-031: `Notification` — the runtime is handing control to the
  // operator. An `ask_user` call is the one unambiguous "the agent needs your
  // attention" moment in this runtime (`docs/design/hook-system.md` documented
  // the event as an "observability signal" with no trigger until this wiring).
  // Fired BEFORE the client call so a hook observes the request even if the
  // operator never answers; observation-only and fail-open by the hook contract.
  fireNotificationHook({
    agentState: params.agentState,
    fileContext: params.fileContext,
    reason: 'agent-requested-operator-input',
    toolName: 'ask_user',
    toolInput: toolCall.input as unknown as Record<string, JSONValue>,
  })

  const result = await requestClientToolCall(toolCall)
  return {
    output: result,
  }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
