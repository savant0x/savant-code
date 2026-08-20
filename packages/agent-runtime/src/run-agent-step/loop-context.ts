import { buildArray } from '@savant-code/common/util/array'
import {
  DRIVE_STRIPPED_TOOL_NAMES,
  parseDriveControlDirective,
  parseDriveLockDirective,
} from '@savant-code/common/util/drive-directives'
import { userMessage } from '@savant-code/common/util/messages'
import { generateCompactId } from '@savant-code/common/util/string'
import { mapValues } from 'lodash'

import { ContextCompactor } from '../context-compactor'
import {
  createGoalRecord,
  parseGoalControlDirective,
  parseGoalSetDirective,
  pauseGoal,
  resumeGoal,
} from './goal-engine'
import { toTokenCountInputSchema } from './token-count'
import { additionalToolDefinitions } from './tool-definitions'
import { additionalSystemPrompts } from '../system-prompt/prompts'
import { getAgentTemplate } from '../templates/agent-registry'
import { buildAgentToolSet } from '../templates/prompts'
import { getAgentPrompt } from '../templates/strings'
import { filterToolSet } from '../tools/filter-tool-set'
import { getToolSet } from '../tools/prompts'
import {
  withSystemInstructionTags,
  buildUserMessageContent,
} from '../util/messages'

import type { LoopAgentStepsParams } from './types'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
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

  // FID-2026-0818-002: drive-mode lock. The CLI serializes a `<drive-lock>`
  // directive only after the operator Confirms the pre-build plan (Law 2).
  // Parsing it here records the durable drive record and strips the
  // interactive tools (ask_user / suggest_followups / end_turn) from the
  // model-facing set for the rest of the run — the drive then proceeds to
  // completion without asking again. Idempotent: never overwrites an existing
  // drive record mid-run.
  const driveLock = loopParams.prompt
    ? parseDriveLockDirective(loopParams.prompt)
    : null
  const driveControl = loopParams.prompt
    ? parseDriveControlDirective(loopParams.prompt)
    : null
  let effectiveTools = tools
  if (driveLock && !initialAgentState.drive) {
    initialAgentState.drive = {
      driveId: driveLock.driveId ?? generateCompactId(),
      goal: driveLock.goal,
      ...(driveLock.planId ? { planId: driveLock.planId } : {}),
      acceptanceCriteria: driveLock.acceptanceCriteria,
      ...(driveLock.resolutionPolicy
        ? { resolutionPolicy: driveLock.resolutionPolicy }
        : {}),
      status: 'active',
      startedAt: Date.now(),
    }
    const stripped = new Set(DRIVE_STRIPPED_TOOL_NAMES)
    effectiveTools = filterToolSet(
      tools,
      Object.keys(tools).filter((name) => !stripped.has(name)),
    )
    loopParams.logger.info(
      { driveId: initialAgentState.drive.driveId },
      'Drive mode locked via <drive-lock> — interactive tools stripped',
    )
  }

  // FID-2026-0818-007: drive control surface. pause/stop/resume operate on the
  // durable drive record (operator control, never a confirmation). `stop` is
  // terminal and recorded; `resume` restarts a paused drive; a control with no
  // existing drive record is a no-op (fail closed).
  if (driveControl && initialAgentState.drive) {
    const drive = initialAgentState.drive
    if (driveControl.action === 'pause') {
      drive.status = 'paused'
      loopParams.logger.info(
        { driveId: drive.driveId },
        'Drive paused via <drive-control>',
      )
    } else if (driveControl.action === 'resume') {
      drive.status = 'active'
      loopParams.logger.info(
        { driveId: drive.driveId },
        'Drive resumed via <drive-control>',
      )
    } else if (driveControl.action === 'stop') {
      drive.status = 'blocked'
      loopParams.logger.info(
        {
          driveId: drive.driveId,
          reason: driveControl.reason ?? 'operator stop',
        },
        'Drive stopped via <drive-control> (terminal)',
      )
    }
  }

  const hasUserMessage = Boolean(
    loopParams.prompt ||
    (loopParams.spawnParams &&
      Object.keys(loopParams.spawnParams).length > 0) ||
    (loopParams.content && loopParams.content.length > 0),
  )

  const initialMessages = buildArray<Message>(
    ...initialAgentState.messageHistory,

    hasUserMessage && [
      {
        // Actual user message!
        role: 'user' as const,
        content: buildUserMessageContent(
          loopParams.prompt,
          loopParams.spawnParams,
          loopParams.content,
        ),
        tags: ['USER_PROMPT'],
        sentAt: Date.now(),

        // James: Deprecate the below, only use tags, which are not prescriptive.
        keepDuringTruncation: true,
      },
      loopParams.prompt &&
        loopParams.prompt in additionalSystemPrompts &&
        userMessage(
          withSystemInstructionTags(
            additionalSystemPrompts[
              loopParams.prompt as keyof typeof additionalSystemPrompts
            ],
          ),
        ),
    ],

    instructionsPrompt &&
      userMessage({
        content: instructionsPrompt,
        tags: ['INSTRUCTIONS_PROMPT'],

        // James: Deprecate the below, only use tags, which are not prescriptive.
        keepLastTags: ['INSTRUCTIONS_PROMPT'],
      }),
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

  // FID-2026-0725-083: Parse goal condition from the initial message.
  // The /goal command sends <goal condition="..."> in the message content.
  // We extract it and store it in agentState.goalCondition for evaluation
  // after each task_completed call.
  if (hasUserMessage && loopParams.prompt) {
    const goalMatch = loopParams.prompt.match(/<goal condition="([^"]+)">/)
    if (goalMatch && !initialAgentState.goalCondition) {
      initialAgentState.goalCondition = goalMatch[1]
      loopParams.logger.info(
        { goalCondition: goalMatch[1] },
        'Goal condition detected from message — will evaluate after each task_completed',
      )
    }
  }

  // FID-2026-0814-002: structured durable-goal directives from the /goal slash
  // surface. `<goal-set>` creates the durable record (idempotent — never
  // overwrites an existing record mid-run) and supersedes the legacy
  // `goalCondition`; `<goal-control>` applies pause/resume/cancel to the
  // existing record. Directive text is parsed as DATA — the CLI escapes
  // attribute values, so user text cannot break the parse or leak into
  // instruction context.
  if (hasUserMessage && loopParams.prompt) {
    const goalSet = parseGoalSetDirective(loopParams.prompt)
    if (goalSet && !initialAgentState.goal) {
      initialAgentState.goal = createGoalRecord({
        goalId: goalSet.goalId,
        objective: goalSet.objective,
        completionCriterion: goalSet.completionCriterion,
        budgetTokens: goalSet.budgetTokens,
        budgetTurns: goalSet.budgetTurns,
        budgetTimeMs: goalSet.budgetTimeMs,
      })
      initialAgentState.goalCondition = undefined
      loopParams.logger.info(
        {
          goalId: initialAgentState.goal.goalId,
          budgetLimits: initialAgentState.goal.budgetLimits,
        },
        'Durable goal created from <goal-set> directive',
      )
    }
    const goalControl = parseGoalControlDirective(loopParams.prompt)
    if (goalControl && initialAgentState.goal) {
      if (goalControl.action === 'pause') {
        pauseGoal(initialAgentState.goal, goalControl.reason)
        loopParams.logger.info(
          { goalId: initialAgentState.goal.goalId },
          'Durable goal paused via <goal-control>',
        )
      } else if (goalControl.action === 'resume') {
        resumeGoal(initialAgentState.goal)
        loopParams.logger.info(
          { goalId: initialAgentState.goal.goalId },
          'Durable goal resumed via <goal-control>',
        )
      } else if (goalControl.action === 'cancel') {
        loopParams.logger.info(
          { goalId: initialAgentState.goal.goalId },
          'Durable goal cancelled via <goal-control> — record cleared',
        )
        initialAgentState.goal = undefined
      }
    }
  }

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
