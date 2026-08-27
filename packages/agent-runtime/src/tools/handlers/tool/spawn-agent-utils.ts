import {
  MAX_AGENT_STEPS_DEFAULT,
  MAX_SUBAGENT_DEPTH,
} from '@savant-code/common/constants/agents'
import { generateCompactId } from '@savant-code/common/util/string'

import {
  buildRestoredEvidenceNote,
  spliceRawEvidence,
} from '../../../evidence/splice'
import {
  buildGraphInjectionMessage,
  buildGraphInjectionUserMessage,
} from '../../../util/graph-injection'
import {
  filterUnfinishedToolCalls,
  withSystemTags,
} from '../../../util/messages'

import type { SubagentPropagationSnapshot } from './execute-subagent'
import type { EvidenceSpillRecord } from '../../../evidence/spill'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type {
  AgentState,
  Subgoal,
} from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

export type SubagentContextParams = AgentRuntimeDeps &
  AgentRuntimeScopedDeps & {
    agentState?: AgentState
    /** Explicit propagation snapshot for the child boundary. */
    propagation?: SubagentPropagationSnapshot
    clientSessionId: string
    extraSavantCodeMetadata?: Record<string, string>
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
          },
        }
      : {}),
  }
}

/**
 * Creates a new agent state for spawned agents
 */
export function createAgentState(
  agentType: string,
  agentTemplate: AgentTemplate,
  parentAgentState: AgentState,
  agentContext: Record<string, Subgoal>,
  graphInjectionProjectRoot?: string,
  rawEvidenceRecords?: EvidenceSpillRecord[],
): AgentState {
  if (parentAgentState.ancestorRunIds.length >= MAX_SUBAGENT_DEPTH) {
    throw new Error(
      `Subagent depth limit exceeded (maximum ${MAX_SUBAGENT_DEPTH} ancestors).`,
    )
  }

  const agentId = generateCompactId()

  // When including message history, filter out any tool calls that don't have
  // corresponding tool responses. This prevents the spawned agent from seeing
  // unfinished tool calls which throw errors in the Anthropic API.
  let messageHistory: Message[] = []

  if (agentTemplate.includeMessageHistory) {
messageHistory = filterUnfinishedToolCalls(parentAgentState.messageHistory)
    // FID-2026-0824-026: restore raw evidence over compaction sentinels for
    // audit agents (requiresRawEvidence) BEFORE knowledge-graph/spawn markers.
    if (rawEvidenceRecords && rawEvidenceRecords.length > 0) {
      const recordsById = new Map(
        rawEvidenceRecords.map((record) => [record.toolCallId, record]),
      )
      const spliced = spliceRawEvidence(messageHistory, recordsById)
      messageHistory = spliced.messages
      const note = buildRestoredEvidenceNote(spliced.restoredToolCallIds)
      if (note !== null) {
        messageHistory.push({
          role: 'user',
          content: [{ type: 'text', text: withSystemTags(note) }],
          tags: ['EVIDENCE_RESTORED'],
        })
      }
    }
    // FID-2026-0806-002 Phase 3c: harness-injected knowledge-graph evidence.
    // Zero-tool agents (Verifier) and restricted agents (Thinker) may not call
    // the graph query tools; the harness computes the evidence and injects it
    // into message history instead. Best-effort — null evidence is skipped.
    if (graphInjectionProjectRoot) {
      const evidence = buildGraphInjectionMessage({
        projectRoot: graphInjectionProjectRoot,
        agentType,
        parentMessageHistory: parentAgentState.messageHistory,
      })
      if (evidence) {
        messageHistory.push(buildGraphInjectionUserMessage(evidence))
      }
    }
    messageHistory.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: withSystemTags(`Subagent ${agentType} has been spawned.`),
        },
      ],
      tags: ['SUBAGENT_SPAWN'],
    })
  }

  return {
    agentId,
    agentType,
    agentContext,
    ancestorRunIds: [
      ...parentAgentState.ancestorRunIds,
      parentAgentState.runId ?? 'NULL',
    ],
    subagents: [],
    childRunIds: [],
    messageHistory,
    stepsRemaining: MAX_AGENT_STEPS_DEFAULT,
    creditsUsed: 0,
    directCreditsUsed: 0,
    output: undefined,
    parentId: parentAgentState.agentId,
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount: parentAgentState.contextTokenCount,
    fsmPhase: parentAgentState.fsmPhase,
    iterationCount: parentAgentState.iterationCount,
    protocolVariant: parentAgentState.protocolVariant,
    protocolFile: parentAgentState.protocolFile,
    protocolVersion: parentAgentState.protocolVersion,
    protocolStrictMode: parentAgentState.protocolStrictMode,
    // FID-2026-0804-009: thread the run's ECHO compliance tracker into subagent
    // states so subagent writes/verification/spawns record against the same
    // run and the Verifier criteria see the full picture (L-001: Forge wrote
    // without the parent spawning a Verifier).
    echoCompliance: parentAgentState.echoCompliance,
    // FID-2026-0813-004: thread the parent's ZTAP provenance session so
    // subagent writes sign into the same session and Verifier/Adversary
    // verdicts bind to the same receipts.
    provenance: parentAgentState.provenance,
  }
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
