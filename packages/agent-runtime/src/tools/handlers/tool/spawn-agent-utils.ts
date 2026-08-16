import {
  BASE_AGENTS,
  MAX_AGENT_STEPS_DEFAULT,
  MAX_SUBAGENT_DEPTH,
} from '@savant-code/common/constants/agents'
import { toolNames } from '@savant-code/common/tools/constants'
import {
  normalizeAgentIdForLookup,
  parseAgentId,
} from '@savant-code/common/util/agent-id-parsing'
import { generateCompactId } from '@savant-code/common/util/string'

import { buildHookInput, getHookEngine } from '../../../hooks/engine'
import { loopAgentSteps } from '../../../run-agent-step'
import { getAgentTemplate } from '../../../templates/agent-registry'
import { formatValueForError } from '../../../util/format-value'
import {
  buildGraphInjectionMessage,
  buildGraphInjectionUserMessage,
} from '../../../util/graph-injection'
import {
  filterUnfinishedToolCalls,
  withSystemTags,
} from '../../../util/messages'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type {
  ParamsExcluding,
  OptionalFields,
} from '@savant-code/common/types/function-params'
import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type {
  AgentState,
  AgentTemplateType,
  Subgoal,
} from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'
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
}

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
 * Checks if a parent agent is allowed to spawn a child agent
 */
export function getMatchingSpawn(
  spawnableAgents: AgentTemplateType[],
  childFullAgentId: string,
) {
  const {
    publisherId: childPublisherId,
    agentId: childAgentId,
    version: childVersion,
  } = parseAgentId(normalizeAgentIdForLookup(childFullAgentId))

  if (!childAgentId) {
    return null
  }

  for (const spawnableAgent of spawnableAgents) {
    const {
      publisherId: spawnablePublisherId,
      agentId: spawnableAgentId,
      version: spawnableVersion,
    } = parseAgentId(normalizeAgentIdForLookup(spawnableAgent))

    if (!spawnableAgentId) {
      continue
    }

    if (
      spawnableAgentId === childAgentId &&
      spawnablePublisherId === childPublisherId &&
      spawnableVersion === childVersion
    ) {
      return spawnableAgent
    }
    if (!childVersion && childPublisherId) {
      if (
        spawnablePublisherId === childPublisherId &&
        spawnableAgentId === childAgentId
      ) {
        return spawnableAgent
      }
    }
    if (!childPublisherId && childVersion) {
      if (
        spawnableAgentId === childAgentId &&
        spawnableVersion === childVersion
      ) {
        return spawnableAgent
      }
    }

    if (!childVersion && !childPublisherId) {
      if (spawnableAgentId === childAgentId) {
        return spawnableAgent
      }
    }
  }
  return null
}

/**
 * Resolves a child agent for a spawn: applies the spawnableAgents allowlist
 * (or the base-agent bypass), then loads the template. FID-2026-0802-005 H4:
 * this is the single implementation shared by the executor's spawn_agents
 * pre-validation and the spawn handlers — getMatchingSpawn + getAgentTemplate
 * run in exactly one place instead of twice per agent.
 */
export async function resolveSpawnableAgent(
  params: {
    agentTypeStr: string
    parentAgentTemplate: AgentTemplate
  } & ParamsExcluding<typeof getAgentTemplate, 'agentId'>,
): Promise<
  | { ok: true; agentType: string; agentTemplate: AgentTemplate }
  | { ok: false; code: 'not-spawnable' | 'not-found' | 'load-failed' }
> {
  const { agentTypeStr, parentAgentTemplate } = params
  const isBaseAgent = BASE_AGENTS.includes(parentAgentTemplate.id)
  const agentType = isBaseAgent
    ? normalizeAgentIdForLookup(agentTypeStr)
    : getMatchingSpawn(parentAgentTemplate.spawnableAgents, agentTypeStr)

  if (!agentType) {
    return { ok: false, code: 'not-spawnable' }
  }

  try {
    const agentTemplate = await getAgentTemplate({
      ...params,
      agentId: agentType,
    })
    if (!agentTemplate) {
      return { ok: false, code: 'not-found' }
    }
    return { ok: true, agentType, agentTemplate }
  } catch {
    return { ok: false, code: 'load-failed' }
  }
}

/**
 * Validates agent template and permissions (thin wrapper over
 * resolveSpawnableAgent that converts the result into the handler-facing
 * throw contract).
 */
export async function validateAndGetAgentTemplate(
  params: {
    agentTypeStr: string
    parentAgentTemplate: AgentTemplate
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
  } & ParamsExcluding<typeof getAgentTemplate, 'agentId'>,
): Promise<{ agentTemplate: AgentTemplate; agentType: string }> {
  const { agentTypeStr, parentAgentTemplate } = params
  const resolved = await resolveSpawnableAgent({
    ...params,
    parentAgentTemplate,
  })

  if (!resolved.ok) {
    if ((toolNames as readonly string[]).includes(agentTypeStr)) {
      throw new Error(
        `"${agentTypeStr}" is a tool, not an agent. Call it directly as a tool instead of wrapping it in spawn_agents.`,
      )
    }
    if (resolved.code === 'not-spawnable') {
      throw new Error(
        `Agent type ${parentAgentTemplate.id} is not allowed to spawn child agent type ${agentTypeStr}.`,
      )
    }
    throw new Error(`Agent type ${agentTypeStr} not found.`)
  }

  return {
    agentTemplate: resolved.agentTemplate,
    agentType: resolved.agentType,
  }
}

/**
 * Validates prompt and params against agent schema
 */
export function validateAgentInput(
  agentTemplate: AgentTemplate,
  agentType: string,
  prompt?: string,
  params?: JSONValue,
): void {
  const { inputSchema } = agentTemplate

  // Validate prompt requirement
  if (inputSchema.prompt) {
    const result = inputSchema.prompt.safeParse(prompt ?? '')
    if (!result.success) {
      throw new Error(
        `Invalid prompt for agent ${agentType}: ${JSON.stringify(result.error.issues, null, 2)}\n\nOriginal prompt value:\n${formatValueForError(prompt ?? '')}`,
      )
    }
  }

  // Validate params if schema exists
  if (inputSchema.params) {
    const result = inputSchema.params.safeParse(params ?? {})
    if (!result.success) {
      throw new Error(
        `Invalid params for agent ${agentType}: ${JSON.stringify(result.error.issues, null, 2)}\n\nOriginal params value:\n${formatValueForError(params ?? {})}`,
      )
    }
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
  } finally {
    if (hookProjectRoot) {
      getHookEngine(hookProjectRoot).fireAndForgetTrigger(
        buildHookInput({
          event: 'SubagentStop',
          sessionId: subagentSessionId,
          cwd: hookProjectRoot,
          subagentType: agentTemplate.id,
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
