// FID-2026-0819-005 Loop 272: directive/messaging passes extracted to
// loop-context-drive.ts (drive lock + control), loop-context-messages.ts
// (initial history build), loop-context-goals.ts (goal directives). This
// module keeps the core setup: template resolution, run start, prompt/tool
// assembly, token-count shaping, and the ContextCompactor.
import { mapValues } from 'lodash'

import { ContextCompactor } from '../context-compactor'
import { applyDriveDirectives } from './loop-context-drive'
import { applyGoalDirectives } from './loop-context-goals'
import { buildInitialMessages } from './loop-context-messages'
import { toTokenCountInputSchema } from './token-count'
import { additionalToolDefinitions } from './tool-definitions'
import { getAgentTemplate } from '../templates/agent-registry'
import { buildAgentToolSet } from '../templates/prompts'
import { getAgentPrompt } from '../templates/strings'
import { filterToolSet } from '../tools/filter-tool-set'
import { getToolSet } from '../tools/prompts'

import type { LoopAgentStepsParams } from './types'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { CustomToolDefinitions } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

export type LoopContext = {
  agentTemplate: AgentTemplate
  runId: string
  system: string
  tools: ToolSet
  toolsForTokenCount: Array<{
    name: string
    description?: string
    input_schema?: JSONValue
  }>
  additionalToolDefinitionsWithCache: () => Promise<CustomToolDefinitions>
  getCachedAdditionalToolDefinitions: () => CustomToolDefinitions | undefined
  contextCompactor: ContextCompactor
}

/**
 * Runs the agent-loop setup: resolves the agent template, starts the run,
 * builds the system prompt / tools / initial message history, and
 * initializes the ContextCompactor. Mutates `agentState` (the shared
 * reference) exactly as loopAgentSteps did, so in-progress work propagates
 * back to the caller. Returns `ok: false` for the pre-run abort shortcut.
 */
export async function createLoopContext(params: {
  params: LoopAgentStepsParams
  agentState: AgentState
  agentType: string
  parentTools?: ToolSet
  parentSystemPrompt?: string
}): Promise<
  | { ok: false; agentState: AgentState }
  | {
      ok: true
      ctx: LoopContext
    }
> {
  const {
    params: loopParams,
    agentState: initialAgentState,
    agentType,
    parentTools,
    parentSystemPrompt,
  } = params

  let agentTemplate = loopParams.agentTemplate
  if (!agentTemplate) {
    agentTemplate =
      (await getAgentTemplate({
        ...loopParams,
        agentId: agentType,
      })) ?? undefined
  }
  if (!agentTemplate) {
    throw new Error(`Agent template not found for type: ${agentType}`)
  }

  if (loopParams.signal.aborted) {
    return {
      ok: false,
      agentState: initialAgentState,
    }
  }

  const runId = await loopParams.startAgentRun({
    ...loopParams,
    agentId: agentTemplate.id,
    ancestorRunIds: initialAgentState.ancestorRunIds,
  })
  if (!runId) {
    throw new Error('Failed to start agent run')
  }
  initialAgentState.runId = runId

  let cachedAdditionalToolDefinitions: CustomToolDefinitions | undefined
  // Use parent's tools for prompt caching when inheritParentSystemPrompt is true
  const useParentTools =
    agentTemplate.inheritParentSystemPrompt && parentTools !== undefined
  const inheritedParentTools: ToolSet = parentTools ?? {}

  const buildAdditionalToolDefinitions = async () => {
    if (!cachedAdditionalToolDefinitions) {
      cachedAdditionalToolDefinitions = await additionalToolDefinitions({
        ...loopParams,
        agentTemplate,
      })
    }
    return cachedAdditionalToolDefinitions
  }

  // Initialize message history with user prompt and instructions on first iteration
  const instructionsPrompt = await getAgentPrompt({
    ...loopParams,
    agentTemplate,
    promptType: { type: 'instructionsPrompt' },
    agentTemplates: loopParams.localAgentTemplates,
    useParentTools,
    additionalToolDefinitions: buildAdditionalToolDefinitions,
  })

  // Build the initial message history with user prompt and instructions
  // Generate system prompt once, using parent's if inheritParentSystemPrompt is true
  let system: string
  if (agentTemplate.inheritParentSystemPrompt && parentSystemPrompt) {
    system = parentSystemPrompt
  } else {
    const systemPrompt = await getAgentPrompt({
      ...loopParams,
      agentTemplate,
      promptType: { type: 'systemPrompt' },
      agentTemplates: loopParams.localAgentTemplates,
      additionalToolDefinitions: buildAdditionalToolDefinitions,
    })
    system = systemPrompt ?? ''
  }

  // Prompt inheritance and capability inheritance are separate concerns. A
  // child may reuse the parent's system prompt while still needing its own
  // tool definitions when the parent does not contain every allowed tool.
  const parentToolKeys = new Set(Object.keys(inheritedParentTools))
  const childToolsSubsetOfParent = agentTemplate.toolNames.every((toolName) =>
    parentToolKeys.has(toolName),
  )
  const useInheritedTools = useParentTools && childToolsSubsetOfParent

  // Build agent tools (agents as direct tool calls) whenever the child needs
  // its own tool construction. This preserves spawnable child-agent tools in
  // the same fallback path as built-in, custom, MCP, and skill tools.
  const agentTools = useInheritedTools
    ? {}
    : await buildAgentToolSet({
        ...loopParams,
        spawnableAgents: agentTemplate.spawnableAgents,
        agentTemplates: loopParams.localAgentTemplates,
      })

  const tools = useInheritedTools
    ? filterToolSet(inheritedParentTools, agentTemplate.toolNames)
    : await getToolSet({
        toolNames: agentTemplate.toolNames,
        additionalToolDefinitions: buildAdditionalToolDefinitions,
        agentTools,
        skills: loopParams.fileContext.skills ?? {},
      })

  // FID-2026-0818-002/-007: drive-lock and drive-control directives
  // (extracted verbatim to loop-context-drive.ts). Returns the effective
  // tool set — interactive tools stripped when a drive locks.
  const effectiveTools = applyDriveDirectives(
    loopParams,
    initialAgentState,
    tools,
  )

  // Initial message history (extracted verbatim to
  // loop-context-messages.ts); hasUserMessage guards the goal directives.
  const { hasUserMessage, initialMessages } = buildInitialMessages(
    loopParams,
    initialAgentState,
    instructionsPrompt,
  )

  // Convert tools to a serializable format for context-pruner token counting.
  // FID-2026-0802-005 L9: the inputSchema slot is typed as JSONValue (it feeds
  // toTokenCountInputSchema, which handles Zod + JSON Schema + garbage); the
  // AI SDK JSONSchema → JSONValue conversion is an honest trust-boundary
  // assertion (tracked in the FID-029 ledger), not a cast-to-nothing.
  const toolDefinitions: Record<
    string,
    { description: string | undefined; inputSchema: JSONValue }
  > = mapValues(effectiveTools, (tool) => ({
    description: tool.description,
    inputSchema: tool.inputSchema as unknown as JSONValue,
  }))

  const additionalToolDefinitionsWithCache = buildAdditionalToolDefinitions

  // Mutate initialAgentState so that in-progress work propagates back to the
  // caller's shared reference (e.g. SDK's sessionState.mainAgentState) even if
  // an error is thrown before we return.
  initialAgentState.messageHistory = initialMessages
  initialAgentState.systemPrompt = system
  initialAgentState.toolDefinitions = toolDefinitions

  // Convert tool definitions to Anthropic format for accurate token counting.
  // Tool definitions are stored as { [name]: { description, inputSchema } },
  // where inputSchema is a Zod schema. Anthropic's count_tokens API expects
  // [{ name, description, input_schema }] with input_schema being real JSON
  // Schema (with a top-level `type: 'object'`) — see toTokenCountInputSchema.
  const toolsForTokenCount = Object.entries(toolDefinitions).map(
    ([name, def]) => {
      const input_schema = toTokenCountInputSchema(def.inputSchema)
      return {
        name,
        ...(def.description && { description: def.description }),
        ...(input_schema && { input_schema }),
      }
    },
  )

  // FID-2026-0725-083 / FID-2026-0814-002: goal condition capture and the
  // durable <goal-set>/<goal-control> directives (extracted verbatim to
  // loop-context-goals.ts).
  applyGoalDirectives(loopParams, initialAgentState, hasUserMessage)

  // FID-2026-0725-085: Initialize ContextCompactor for micro-compact before each API call.
  // This runs at the start of the agent loop so it's available for every iteration.
  // Use resolved contextWindow from CLI (CTX-007) or infer from model name (CTX-003).
  const contextCompactor = new ContextCompactor({
    logger: loopParams.logger,
    contextWindow: loopParams.contextWindow,
    model: agentTemplate.model,
    // FID-2026-0814-004 H-05/H-06: operator config from `protocol.config.yaml`
    // `compression` — `microCompact` off honors the off-switch, and
    // `microCompactMaxKeepRecent` drives the pressure gate.
    microCompactEnabled: loopParams.compression?.microCompact,
    autoCompactRatio: loopParams.compression?.autoCompactRatio,
    microCompactMaxKeepRecent:
      loopParams.compression?.microCompactMaxKeepRecent,
    microCompactFloorTokens: loopParams.compression?.microCompactFloorTokens,
  })
  // FID-2026-0725-085 Layer 3: Wire resolved context window into agentState
  // so handleSteps (savant.ts) can use it for auto-compact threshold.
  // FID-2026-0814-012: read the compactor's reactiveCompact (= contextWindow)
  // directly — the resolved window, exactly — instead of reconstructing it as
  // autoCompact + 30_000 (which overshoots when the Math.max(..., 100_000)
  // clamp kicks in at small windows, and duplicates the buffer magic number).
  initialAgentState.maxContextLength =
    contextCompactor.getThresholds().reactiveCompact
  // FID-2026-0824-024 post-closure amendment: stamp operator-configured
  // digest caps onto the root state so the inline spawn boundary can inject
  // them into context-pruner spawn params (see spawn-agent-inline.ts).
  if (
    loopParams.compression?.digestHeadChars !== undefined ||
    loopParams.compression?.digestTailChars !== undefined
  ) {
    initialAgentState.digestCaps = {
      ...(loopParams.compression.digestHeadChars !== undefined
        ? { headChars: loopParams.compression.digestHeadChars }
        : {}),
      ...(loopParams.compression.digestTailChars !== undefined
        ? { tailChars: loopParams.compression.digestTailChars }
        : {}),
    }
  }

  return {
    ok: true,
    ctx: {
      agentTemplate,
      runId,
      system,
      tools: effectiveTools,
      toolsForTokenCount,
      additionalToolDefinitionsWithCache,
      getCachedAdditionalToolDefinitions: () => cachedAdditionalToolDefinitions,
      contextCompactor,
    },
  }
}
