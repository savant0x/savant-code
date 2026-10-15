/**
 * Wired agent-runtime assembly for run execution: builds the stream-chunk
 * handlers, the prompt-response action binding, and the runtime impl that
 * consumes them. Extracted verbatim from runOnce; the parent supplies the
 * settlement handles and session context.
 */

import { buildAgentRuntimeImpl } from '../agent-runtime-impl'
import { handlePromptResponse } from '../response'
import { createStreamChunkHandlers } from '../stream-handlers'

import type { createRunSettlement } from './settlement'
import type { RunExecutionOptions } from '../types'
import type { ServerAction } from '@savant-code/common/actions'
import type { SessionState } from '@savant-code/common/types/session-state'

type RuntimeImplParams = Parameters<typeof buildAgentRuntimeImpl>[0]
type RuntimeImpl = ReturnType<typeof buildAgentRuntimeImpl>

export function buildWiredAgentRuntime(deps: {
  /** Everything buildAgentRuntimeImpl needs except the three handler wires
   *  assembled here. */
  runtimeBase: Omit<
    RuntimeImplParams,
    'onResponseChunk' | 'onSubagentResponseChunk' | 'handlePromptResponseAction'
  >
  handleEvent: RunExecutionOptions['handleEvent']
  handleStreamChunk: RunExecutionOptions['handleStreamChunk']
  safeDispatch: ReturnType<typeof createRunSettlement>['dispatch']
  resolve: ReturnType<typeof createRunSettlement>['resolve']
  initialSessionState: SessionState
  traceSessionId: string
}): RuntimeImpl {
  const {
    runtimeBase,
    handleEvent,
    handleStreamChunk,
    safeDispatch,
    resolve,
    initialSessionState,
    traceSessionId,
  } = deps

  const { onResponseChunk, onSubagentResponseChunk } =
    createStreamChunkHandlers({
      signal: runtimeBase.signal,
      handleEvent,
      handleStreamChunk,
      safeDispatch,
    })
  const handlePromptResponseAction = (
    action: ServerAction<'prompt-response'> | ServerAction<'prompt-error'>,
  ) => {
    handlePromptResponse({
      action,
      resolve,
      onError: runtimeBase.onError,
      initialSessionState,
      traceSessionId,
    })
  }

  return buildAgentRuntimeImpl({
    ...runtimeBase,
    onResponseChunk,
    onSubagentResponseChunk,
    handlePromptResponseAction,
  })
}
