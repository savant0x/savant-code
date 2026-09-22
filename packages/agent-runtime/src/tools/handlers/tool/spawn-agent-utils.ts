import { inheritRunGovernance } from './spawn-child-state'

import type { SubagentPropagationSnapshot } from './execute-subagent'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

export type SubagentContextParams = AgentRuntimeDeps &
  AgentRuntimeScopedDeps & {
    agentState?: AgentState
    /** Explicit propagation snapshot for the child boundary. */
    propagation?: SubagentPropagationSnapshot
    clientSessionId: string
    extraSavantCodeMetadata?: Record<string, string>
    /** FID-2026-0909-008 Step 4: the run's resolved output budget. The
     *  spawn sites pass it to the child loop only when the child runs the
     *  model the budget was resolved for (see the childOutputBudget guards
     *  in spawn-agents-child-run.ts / spawn-agent-inline.ts). */
    maxOutputTokens?: number
    fileContext: ProjectFileContext
    localAgentTemplates: Record<string, AgentTemplate>
    repoId: string | undefined
    repoUrl: string | undefined
    signal: AbortSignal
    userId: string | undefined
  }

export {
  getMatchingSpawn,
  resolveSpawnableAgent,
  validateAndGetAgentTemplate,
  validateAgentInput,
} from './spawn-agent-resolution'
// FID-2026-0919-027: child-state construction moved to `spawn-child-state.ts`
// (300-line ceiling + the run-governance inheritance it now owns). The spawn
// sites keep importing it from here — this stays the spawn toolkit's surface.
export { createAgentState, inheritRunGovernance } from './spawn-child-state'
export { executeSubagent } from './execute-subagent'
export type { SubagentPropagationSnapshot } from './execute-subagent'

/**
 * Extracts the common context params needed for spawning subagents.
 * This avoids bugs from spreading all params with `...params` which can
 * accidentally pass through params that should be overridden.
 */
export function extractSubagentContextParams(
  params: SubagentContextParams,
): SubagentContextParams {
  return {
    // AgentRuntimeDeps - Environment
    clientEnv: params.clientEnv,
    ciEnv: params.ciEnv,
    // AgentRuntimeDeps - Database
    getUserInfoFromApiKey: params.getUserInfoFromApiKey,
    fetchAgentFromDatabase: params.fetchAgentFromDatabase,
    startAgentRun: params.startAgentRun,
    finishAgentRun: params.finishAgentRun,
    addAgentStep: params.addAgentStep,
    // AgentRuntimeDeps - Billing
    consumeCreditsWithFallback: params.consumeCreditsWithFallback,
    // AgentRuntimeDeps - LLM
    promptAiSdkStream: params.promptAiSdkStream,
    promptAiSdk: params.promptAiSdk,
    promptAiSdkStructured: params.promptAiSdkStructured,
    // AgentRuntimeDeps - Mutable State
    databaseAgentCache: params.databaseAgentCache,
    // AgentRuntimeDeps - Analytics
    trackEvent: params.trackEvent,
    // AgentRuntimeDeps - Other
    logger: params.logger,
    traceWriter: params.traceWriter,
    fetch: params.fetch,

    // AgentRuntimeScopedDeps - Client (WebSocket)
    handleStepsLogChunk: params.handleStepsLogChunk,
    requestToolCall: params.requestToolCall,
    requestMcpToolData: params.requestMcpToolData,
    requestFiles: params.requestFiles,
    requestOptionalFile: params.requestOptionalFile,
    sendAction: params.sendAction,
    sendSubagentChunk: params.sendSubagentChunk,
    apiKey: params.apiKey,

    // Checkpointing (FID-2026-0803-004) — subagent writes land in the parent
    // turn's checkpoint so a rewind restores everything the turn touched.
    checkpointDir: params.checkpointDir,
    checkpointTurnId: params.checkpointTurnId,

    // Core context params
    clientSessionId: params.clientSessionId,
    extraSavantCodeMetadata: params.extraSavantCodeMetadata,
    fileContext: params.fileContext,
    localAgentTemplates: params.localAgentTemplates,
    repoId: params.repoId,
    repoUrl: params.repoUrl,
    signal: params.signal,
    userId: params.userId,
    ...(params.agentState
      ? {
          agentState: params.agentState,
          propagation: {
            parentAgentId: params.agentState.agentId,
            parentRunId: params.agentState.runId,
            ancestorRunIds: [...params.agentState.ancestorRunIds],
            protocolVariant: params.agentState.protocolVariant,
            protocolFile: params.agentState.protocolFile,
            protocolVersion: params.agentState.protocolVersion,
            protocolStrictMode: params.agentState.protocolStrictMode,
            checkpointTurnId: params.checkpointTurnId,
            hasTraceWriter: params.traceWriter !== undefined,
            // FID-2026-0919-027: governance configuration travels with the
            // child so `executeSubagent` can PROVE the child state was built
            // from this parent (see the propagation contract there).
            ...inheritRunGovernance(params.agentState),
          },
        }
      : {}),
  }
}

/**
 * FID-2026-0909-008 Step 4 (Law 13: one guard, two spawn sites): the run's
 * resolved output budget propagates to a child agent loop only when the
 * child actually runs the model the budget was resolved for. withParentModel
 * already aligned the models unless the child pinned its own
 * (inheritParentModel: false). A budget from a different model is worse than
 * none — omit it and let the provider default govern rather than cap the
 * child at a foreign limit.
 */
export function resolveChildOutputBudget(
  childTemplate: AgentTemplate,
  parentTemplate: AgentTemplate,
  maxOutputTokens: number | undefined,
): number | undefined {
  return childTemplate.model === parentTemplate.model
    ? maxOutputTokens
    : undefined
}

/**
 * Returns a shallow clone of the child agent template with its model replaced
 * by the parent agent template's model. This ensures subagents respect the
 * user's selected model instead of using their own hardcoded defaults.
 *
 * Agents that declare `inheritParentModel: false` keep their own model, which
 * is useful for reasoning helpers that are intentionally tied to a specific
 * model (e.g. the Gemini thinker).
 *
 * FID-2026-0814-009 B-06: the child's providerOptions are merged OVER the
 * parent's rather than replaced wholesale. Infra helpers (tmux-cli,
 * browser-use, database, github) set `data_collection: 'deny'` to keep
 * browser/DB/token/CLI content out of provider training data; a naive replace
 * silently dropped that flag when the default (paid) savant — whose
 * providerOptions are empty — spawned them. The child's explicit options win
 * so the privacy flag survives model inheritance.
 */
export function withParentModel(
  agentTemplate: AgentTemplate,
  parentAgentTemplate: AgentTemplate,
): AgentTemplate {
  if (agentTemplate.inheritParentModel === false) {
    return agentTemplate
  }

  return {
    ...agentTemplate,
    model: parentAgentTemplate.model,
    providerOptions: {
      ...parentAgentTemplate.providerOptions,
      ...agentTemplate.providerOptions,
    },
  }
}
