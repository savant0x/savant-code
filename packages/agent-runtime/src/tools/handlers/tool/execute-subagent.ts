import { buildHookInput, getHookEngine } from '../../../hooks/engine'
import { buildSubagentOutcome } from '../../../hooks/subagent-outcome'
import { loopAgentSteps } from '../../../run-agent-step'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type {
  ParamsExcluding,
  OptionalFields,
} from '@savant-code/common/types/function-params'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ToolSet } from 'ai'

/**
 * Common context params needed for spawning subagents.
 * These are the params that don't change between different spawn calls
 * and are passed through from the parent agent runtime.
 */
export type SubagentPropagationSnapshot = {
  parentAgentId: string
  parentRunId: string | undefined
  ancestorRunIds: string[]
  protocolVariant: AgentState['protocolVariant']
  protocolFile: string | undefined
  protocolVersion: string | undefined
  protocolStrictMode: boolean | undefined
  checkpointTurnId: string | undefined
  hasTraceWriter: boolean
  // FID-2026-0919-027: the run's resolved governance configuration, carried in
  // the snapshot so the contract below can PROVE the child inherited it — a
  // child built without these reads as a different (ungoverned) run.
  enforcementMode: AgentState['enforcementMode']
  protocolSource: AgentState['protocolSource']
  provenanceMode: AgentState['provenanceMode']
  designContract: AgentState['designContract']
}

/**
 * Executes a subagent using loopAgentSteps
 */
export async function executeSubagent(
  options: OptionalFields<
    {
      propagation: SubagentPropagationSnapshot
      agentTemplate: AgentTemplate
      parentAgentState: AgentState
      parentTools?: ToolSet
      onResponseChunk: (chunk: string | PrintModeEvent) => void
      isOnlyChild?: boolean
      ancestorRunIds: string[]
    } & ParamsExcluding<typeof loopAgentSteps, 'agentType' | 'ancestorRunIds'>,
    'isOnlyChild' | 'clearUserPromptMessagesAfterResponse'
  >,
) {
  const withDefaults = {
    isOnlyChild: false,
    clearUserPromptMessagesAfterResponse: true,
    ...options,
  }
  const {
    onResponseChunk,
    agentTemplate,
    parentAgentState,
    isOnlyChild,
    ancestorRunIds,
    prompt,
    spawnParams,
  } = withDefaults

  const propagation = withDefaults.propagation
  if (!propagation) {
    throw new Error('Subagent propagation context is missing.')
  }
  if (
    propagation.parentAgentId !== parentAgentState.agentId ||
    propagation.parentRunId !== parentAgentState.runId ||
    propagation.protocolVariant !== parentAgentState.protocolVariant ||
    propagation.protocolFile !== parentAgentState.protocolFile ||
    propagation.protocolVersion !== parentAgentState.protocolVersion ||
    propagation.protocolStrictMode !== parentAgentState.protocolStrictMode ||
    propagation.enforcementMode !== parentAgentState.enforcementMode ||
    propagation.protocolSource !== parentAgentState.protocolSource ||
    propagation.provenanceMode !== parentAgentState.provenanceMode ||
    propagation.designContract !== parentAgentState.designContract ||
    propagation.ancestorRunIds.length !==
      parentAgentState.ancestorRunIds.length ||
    propagation.ancestorRunIds.some(
      (runId: string, index: number) =>
        runId !== parentAgentState.ancestorRunIds[index],
    )
  ) {
    throw new Error('Subagent propagation context does not match parent state.')
  }
  const expectedChildAncestorRunIds = [
    ...propagation.ancestorRunIds,
    propagation.parentRunId ?? 'NULL',
  ]
  if (
    withDefaults.agentState.parentId !== propagation.parentAgentId ||
    withDefaults.agentState.ancestorRunIds.length !==
      expectedChildAncestorRunIds.length ||
    withDefaults.agentState.ancestorRunIds.some(
      (runId: string, index: number) =>
        runId !== expectedChildAncestorRunIds[index],
    ) ||
    withDefaults.agentState.protocolVariant !==
      parentAgentState.protocolVariant ||
    withDefaults.agentState.protocolFile !== parentAgentState.protocolFile ||
    withDefaults.agentState.protocolVersion !==
      parentAgentState.protocolVersion ||
    withDefaults.agentState.protocolStrictMode !==
      parentAgentState.protocolStrictMode ||
    // FID-2026-0919-027: governance inheritance is verified, not assumed —
    // a child state missing any of these is not part of this run.
    withDefaults.agentState.enforcementMode !==
      parentAgentState.enforcementMode ||
    withDefaults.agentState.protocolSource !==
      parentAgentState.protocolSource ||
    withDefaults.agentState.provenanceMode !==
      parentAgentState.provenanceMode ||
    withDefaults.agentState.designContract !==
      parentAgentState.designContract ||
    withDefaults.checkpointTurnId !== propagation.checkpointTurnId ||
    (withDefaults.traceWriter !== undefined) !== propagation.hasTraceWriter
  ) {
    throw new Error(
      'Constructed child state does not match propagation context.',
    )
  }

  const startEvent = {
    type: 'subagent_start' as const,
    agentId: withDefaults.agentState.agentId,
    agentType: agentTemplate.id,
    displayName: agentTemplate.displayName,
    onlyChild: isOnlyChild,
    parentAgentId: parentAgentState.agentId,
    prompt,
    params: spawnParams,
  }
  onResponseChunk(startEvent)

  // FID-2026-0814-003: SubagentStart/SubagentStop hooks — observation only,
  // fire-and-forget, fired at the subagent lifecycle boundary (this is the
  // single funnel shared by spawn_agents and spawn_agent_inline).
  const hookProjectRoot =
    withDefaults.fileContext?.projectRoot ?? withDefaults.fileContext?.cwd ?? ''
  const subagentSessionId =
    withDefaults.agentState.runId ?? withDefaults.agentState.agentId
  if (hookProjectRoot) {
    getHookEngine(hookProjectRoot).fireAndForgetTrigger(
      buildHookInput({
        event: 'SubagentStart',
        sessionId: subagentSessionId,
        cwd: hookProjectRoot,
        subagentType: agentTemplate.id,
        toolInput: {
          parentAgentId: parentAgentState.agentId,
          ...(prompt !== undefined ? { prompt } : {}),
        },
      }),
    )
  }

  // FID-2026-0919-029: the SubagentStop payload needs the OUTCOME, not just the
  // identity. The default is the truthful "unknown ⇒ failed"; each terminal
  // branch replaces it before the boundary fires (see hooks/subagent-outcome.ts).
  let outcome = buildSubagentOutcome({ agentType: agentTemplate.id })
  let result
  try {
    result = await loopAgentSteps({
      ...withDefaults,
      // Don't propagate parent's image content to subagents.
      // If subagents need to see images, they get them through includeMessageHistory,
      // not by creating new image-containing messages for their prompts.
      content: undefined,
      ancestorRunIds: [...ancestorRunIds, parentAgentState.runId ?? ''],
      agentType: agentTemplate.id,
    })
    outcome = buildSubagentOutcome({ agentType: agentTemplate.id, result })
  } catch (error) {
    // Only pre-loop failures and 402 propagate (the loop's own error arm returns
    // an error-form output instead), so this arm exists to keep the hook payload
    // truthful in exactly those cases.
    outcome = buildSubagentOutcome({
      agentType: agentTemplate.id,
      error,
    })
    throw error
  } finally {
    if (hookProjectRoot) {
      getHookEngine(hookProjectRoot).fireAndForgetTrigger(
        buildHookInput({
          event: 'SubagentStop',
          sessionId: subagentSessionId,
          cwd: hookProjectRoot,
          subagentType: agentTemplate.id,
          toolResult: outcome,
          ...(outcome.errorMessage !== undefined
            ? { errorMessage: outcome.errorMessage }
            : {}),
        }),
      )
    }
  }

  onResponseChunk({
    type: 'subagent_finish',
    agentId: result.agentState.agentId,
    agentType: agentTemplate.id,
    displayName: agentTemplate.displayName,
    onlyChild: isOnlyChild,
    parentAgentId: parentAgentState.agentId,
    prompt,
    params: spawnParams,
  })

  if (result.agentState.runId) {
    parentAgentState.childRunIds.push(result.agentState.runId)
  }

  return result
}
