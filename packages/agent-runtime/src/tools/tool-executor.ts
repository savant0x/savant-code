import {
  endsAgentStepParam,
  toolNames,
} from '@savant-code/common/tools/constants'
import { toolParams } from '@savant-code/common/tools/list'
import { type SandboxPermissionMode } from '@savant-code/common/tools/safety'
import { resolveAndContain } from '@savant-code/common/util/paths'
import { generateCompactId } from '@savant-code/common/util/string'
import { toJSONValue } from '@savant-code/common/util/type-narrowing'
import { cloneDeep } from 'lodash'

import { getMCPToolData } from '../mcp'
import { MCP_TOOL_SEPARATOR } from '../mcp-constants'
import { captureSnapshot } from './handlers/tool/checkpoint-store'
import { evaluateToolCall, createDefaultSandboxPolicy } from './sandbox'
import { getAgentShortName, getAgentToolName } from '../templates/prompts'
import { formatValueForError } from '../util/format-value'
import { savantCode$1 } from './handlers/list'
import { resolveSpawnableAgent } from './handlers/tool/spawn-agent-utils'
import { ensureZodSchema } from './prompts'
import { toolActivity, setActivity } from '../util/activity-tracking'

import type { AgentTemplate } from '../templates/types'
import type { SavantCodeToolHandlerFunction } from './handlers/handler-function-type'
import type { FileProcessingState } from './handlers/tool/write-file'
import type { ToolName } from '@savant-code/common/tools/constants'
import type {
  ClientToolCall,
  ClientToolName,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type {
  AgentTemplateType,
  AgentState,
  Subgoal,
} from '@savant-code/common/types/session-state'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@savant-code/common/util/file'
import type { ToolCallPart, ToolSet } from 'ai'

export type CustomToolCall = {
  toolName: string
  input: Record<string, JSONValue>
} & Omit<ToolCallPart, 'type'>

function isJSONObject(value: JSONValue): value is Record<string, JSONValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export type ToolCallError = {
  toolName?: string
  input: JSONValue
  error: string
} & Pick<SavantCodeToolCall, 'toolCallId'>

const bareStringFieldRepairAllowlist: Partial<
  Record<string, readonly string[]>
> = {
  code_search: ['pattern'],
  find_files: ['prompt'],
  glob: ['pattern'],
  list_directory: ['path'],
  lookup_agent_info: ['agentId'],
  read_files: ['paths'],
  read_subtree: ['paths'],
  read_url: ['url'],
  skill: ['name'],
  web_search: ['query'],
}

function repairBareStringFieldObject(
  input: string,
  toolName: string,
): Record<string, string> | undefined {
  const allowedFields = bareStringFieldRepairAllowlist[toolName]
  if (!allowedFields) {
    return undefined
  }

  const match = input
    .trim()
    .match(
      /^\{\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*:\s*([^"{}\[\],][^{}\[\],]*)\s*\}$/,
    )
  if (!match) {
    return undefined
  }

  const [, field, rawValue] = match
  if (!allowedFields.includes(field)) {
    return undefined
  }

  const value = rawValue.trim()
  if (!value || value === 'null' || value === 'undefined') {
    return undefined
  }

  return { [field]: value }
}

function parseStringifiedToolInput(
  input: JSONValue,
  toolName: string,
): { input: JSONValue; parseError?: string } {
  let parsed = input
  let parseError: string | undefined

  // Some providers/models double-encode tool arguments, for example an input
  // value like "\"{\\\"path\\\":\\\"file.ts\\\"}\"". Repeated JSON.parse
  // handles that before falling back to narrow, tool-specific repairs.
  for (let i = 0; i < 3 && typeof parsed === 'string'; i++) {
    const stringInput = parsed
    try {
      parsed = JSON.parse(stringInput)
      parseError = undefined
    } catch (error) {
      const repaired = repairBareStringFieldObject(stringInput, toolName)
      if (repaired !== undefined) {
        parsed = repaired
        parseError = undefined
      } else {
        parseError = error instanceof Error ? error.message : String(error)
      }
      break
    }
  }

  return { input: parsed, parseError }
}

function stringInputError(
  toolName: string,
  toolCallId: string,
  parseError?: string,
): ToolCallError {
  const parseDetails = parseError
    ? ` Parsing as JSON failed: ${parseError}. The arguments may be malformed or incomplete.`
    : ' Parsing succeeded, but the parsed value was still a string.'
  return {
    toolName,
    toolCallId,
    input: {},
    error: `Invalid parameters for ${toolName}: expected the tool arguments to be an object, but received a string.${parseDetails} Re-issue the tool call with the full arguments object and properly escaped string values.`,
  }
}

function summarizeMissingReplacementFields(
  toolName: string,
  issues: Array<{
    expected?: string | string[]
    code?: string
    path?: PropertyKey[]
    message?: string
  }>,
): string | undefined {
  if (toolName !== 'str_replace' && toolName !== 'propose_str_replace') {
    return undefined
  }

  const missingFields = issues.flatMap((issue) => {
    const [root, index, field] = issue.path ?? []
    const isMissingReplacementString =
      issue.code === 'invalid_type' &&
      issue.expected === 'string' &&
      issue.message?.includes('received undefined') &&
      root === 'replacements' &&
      typeof index === 'number' &&
      (field === 'oldString' || field === 'newString')

    return isMissingReplacementString ? [`replacements[${index}].${field}`] : []
  })

  if (missingFields.length !== issues.length || missingFields.length === 0) {
    return undefined
  }

  return [
    'Missing required replacement fields:',
    ...missingFields.map((field) => `- ${field}`),
    '',
    'If the intent is deletion, set "newString": "" explicitly.',
  ].join('\n')
}

function getToolValidationHint(toolName: string): string | undefined {
  if (toolName === 'str_replace' || toolName === 'propose_str_replace') {
    return 'Expected shape: { "path": string, "replacements": [{ "oldString": string, "newString": string, "allowMultiple"?: boolean }] }.'
  }
  if (toolName === 'write_file' || toolName === 'propose_write_file') {
    return 'Expected shape: { "path": string, "instructions": string, "content": string }. Quote string values and escape newlines/quotes inside content.'
  }
  if (toolName === 'spawn_agents') {
    return 'Expected shape: { "agents": [{ "agent_type": string, "prompt"?: string, "params"?: object }] }. The top-level value must be an object; "agents" must be an array of objects (not a string).'
  }
  return undefined
}

export function parseRawToolCall<T extends ToolName = ToolName>(params: {
  rawToolCall: {
    toolName: T
    toolCallId: string
    input: JSONValue
  }
}): SavantCodeToolCall<T> | ToolCallError {
  const { rawToolCall } = params
  const toolName = rawToolCall.toolName

  const processedParameters = parseStringifiedToolInput(
    rawToolCall.input,
    toolName,
  )
  const paramsSchema = toolParams[toolName].inputSchema

  if (typeof processedParameters.input === 'string') {
    return stringInputError(
      toolName,
      rawToolCall.toolCallId,
      processedParameters.parseError,
    )
  }

  const result = paramsSchema.safeParse(processedParameters.input)

  if (!result.success) {
    const hint = getToolValidationHint(toolName)
    const summary = summarizeMissingReplacementFields(
      toolName,
      result.error.issues,
    )
    const validationDetails = JSON.stringify(result.error.issues, null, 2)
    return {
      toolName,
      toolCallId: rawToolCall.toolCallId,
      input: rawToolCall.input,
      error: `Invalid parameters for ${toolName}: ${
        summary
          ? `${summary}\n\nRaw validation issues:\n${validationDetails}`
          : validationDetails
      }${hint ? `\n\n${hint}` : ''}`,
    }
  }

  if (endsAgentStepParam in result.data) {
    delete result.data[endsAgentStepParam]
  }

  return {
    toolName,
    input: result.data,
    toolCallId: rawToolCall.toolCallId,
  } as SavantCodeToolCall<T>
}

export type ExecuteToolCallParams<T extends string = ToolName> = {
  toolName: T
  input: Record<string, JSONValue>
  autoInsertEndStepParam?: boolean
  excludeToolFromMessageHistory?: boolean

  agentContext: Record<string, Subgoal>
  agentState: AgentState
  agentStepId: string
  ancestorRunIds: string[]
  agentTemplate: AgentTemplate
  clientSessionId: string
  fileContext: ProjectFileContext
  fileProcessingState: FileProcessingState
  fingerprintId: string
  fromHandleSteps?: boolean
  fullResponse: string
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  previousToolCallFinished: Promise<void>
  prompt: string | undefined
  repoId: string | undefined
  repoUrl: string | undefined
  runId: string
  signal: AbortSignal
  system: string
  tools: ToolSet
  toolCallId: string | undefined
  toolCalls: (SavantCodeToolCall | CustomToolCall)[]
  toolCallsToAddToMessageHistory: (SavantCodeToolCall | CustomToolCall)[]
  toolResults: ToolMessage[]
  toolResultsToAddToMessageHistory: ToolMessage[]
  userId: string | undefined
  userInputId: string
  /** FID-2026-0802-005 H8: step-built custom tool data (incl. MCP tools). When
   *  provided, executeCustomToolCall skips the per-call getMCPToolData rebuild. */
  customToolDefinitions?: CustomToolDefinitions

  fetch: typeof globalThis.fetch
  onCostCalculated: (credits: number) => Promise<void>
  onResponseChunk: (chunk: string | PrintModeEvent) => void
} & AgentRuntimeDeps &
  AgentRuntimeScopedDeps

export async function executeToolCall<T extends ToolName>(
  params: ExecuteToolCallParams<T>,
): Promise<void> {
  const {
    toolName,
    input,
    excludeToolFromMessageHistory = false,
    fromHandleSteps = false,

    agentState,
    agentTemplate,
    logger,
    previousToolCallFinished,
    toolCalls,
    toolCallsToAddToMessageHistory,
    toolResults,
    toolResultsToAddToMessageHistory,
    userInputId,

    onCostCalculated,
    onResponseChunk,
    requestToolCall,
  } = params
  const toolCallId = params.toolCallId ?? generateCompactId()

  const toolCall: SavantCodeToolCall<T> | ToolCallError = parseRawToolCall<T>({
    rawToolCall: {
      toolName,
      toolCallId,
      input,
    },
  })

  // Dev override: bypass ALL tool gating and agent restrictions when devMode is active
  const isDevOverride = params.fileContext.devMode === true

  // FID-2026-0802-005 C1: the parse-error branch MUST run before any
  // `toolCall.input` dereference. On parse failure `toolCall.input` is the raw
  // (unvalidated) input — null or a bare string would crash the write gate
  // below (`TypeError: Cannot read properties of null` / strict-mode
  // `Cannot create property 'path' on string`). This gate ordering is the
  // runtime's most important robustness invariant.
  if ('error' in toolCall) {
    const formattedInput = formatValueForError(input)
    onResponseChunk({
      type: 'error',
      message: `${toolCall.error}\n\nOriginal tool call input:\n${formattedInput}`,
    })
    logger.debug(
      { toolCall, error: toolCall.error },
      `${toolName} error: ${toolCall.error}`,
    )
    return previousToolCallFinished
  }

  // Filter out restricted tools - emit error instead of tool call/result
  // This prevents the CLI from showing tool calls that the agent doesn't have permission to use
  if (
    !isDevOverride &&
    toolCall.toolName &&
    !agentTemplate.toolNames.includes(toolCall.toolName) &&
    !fromHandleSteps
  ) {
    // Emit an error event instead of tool call/result pair
    // The stream parser will convert this to a user message for proper API compliance
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` is not currently available [agent: ${agentTemplate.id}]. Make sure to only use tools provided at the start of the conversation AND that you most recently have permission to use.`,
    })
    return previousToolCallFinished
  }

  // FID-2026-0718-013 v3 F3: containment check runs for every write, regardless
  // of dev mode. The FSM phase check below remains gated by `!isDevOverride` for
  // dev flexibility (dev users can write to any exempt-prefix path during any phase).
  // ECHO FSM tool gating: block write tools unless phase is 'green' or path is exempt.
  // FID-2026-0718-013 v3 adds: projectRoot propagation (F1) and symlink defense (F2).
  if (
    toolCall.toolName &&
    (toolCall.toolName === 'write_file' ||
      toolCall.toolName === 'str_replace' ||
      toolCall.toolName === 'apply_patch')
  ) {
    // Safe to deref: the C1 parse-error branch above already narrowed
    // toolCall to a validated call, so input is the parsed object — never
    // null/string garbage. The cast is only for the zod-inferred input
    // union → Record conversion.
    const input = toolCall.input as Record<string, JSONValue>
    const rawPath = typeof input.path === 'string' ? input.path : ''
    // FID-2026-0718-013 v3 — defensive null check (symmetric with write-file.ts,
    // str-replace.ts, apply-patch.ts handlers). Runtime always provides fileContext,
    // but tests/mocks may omit it. Fail soft with a clear error rather than crash
    // with TypeError reading `undefined.projectRoot`.
    const projectRoot = params.fileContext?.projectRoot
    if (!projectRoot) {
      onResponseChunk({
        type: 'error',
        message: `Tool \`${toolName}\`: fileContext.projectRoot missing — project config invalid (system-level).`,
      })
      return previousToolCallFinished
    }
    const pathResult = resolveAndContain(rawPath, { projectRoot })

    if (pathResult.kind === 'reject') {
      onResponseChunk({
        type: 'error',
        message: `Tool \`${toolName}\`: invalid path — ${pathResult.reason}. Use a path within the project root, or one of the exempt prefixes: dev/fids/, dev/nova/, dev/scratchpad/.`,
      })
      return previousToolCallFinished
    }

    // FID-2026-0725-085 BUG-004: FSM phase check runs AFTER path resolution
    // (needs pathResult to check exempt paths) but BEFORE downstream processing.
    // Phase error is more actionable than toolNames error, so it takes priority.
    // SCAFFOLD mode relaxes the per-write GREEN phase requirement so the
    // orchestrator can write project-root files while a scaffold is in
    // progress; the AUDIT gate is still enforced at scaffold-complete time
    // via the set_scaffold_complete tool.
    // Optimization: Allow writes during self_correct phase too, eliminating
    // the self_correct → green round-trip when fixing audit findings.
    const currentPhase = agentState.fsmPhase ?? 'idle'
    const writePhases = new Set(['green', 'self_correct'])
    if (
      !isDevOverride &&
      pathResult.kind !== 'exempt' &&
      !writePhases.has(currentPhase) &&
      !agentTemplate.scaffoldMode
    ) {
      onResponseChunk({
        type: 'error',
        message: `Tool \`${toolName}\` is only available during green or self_correct phases. Current phase: ${currentPhase}. Call transition_phase to enter green or self_correct first.`,
      })
      return previousToolCallFinished
    }

    // FID-2026-0718-013 v3 F2: rewrite the symlink-resolved realpath into the tool
    // call input so the downstream handler receives a canonical form. Same Q8
    // hardening, plus the resolved path now reflects any symlink chain.
    input.path = pathResult.resolved

    // FID-2026-0803-004: pre-write checkpoint capture (CKR-1/CKR-2). Reads the
    // file's CURRENT content — the pre-edit original — before the handler
    // dispatches the write, and records it under this run's turn so /rewind can
    // restore it. Deduped per path in the store; `content: null` for files that
    // don't exist yet (created this turn ⇒ delete-on-restore). Only fires when
    // the host enabled checkpointing via RunOptions.checkpointDir. `input.path`
    // is a validated string here: the C1 parse-error branch above already
    // narrowed toolCall, and an empty/non-string path was rejected by
    // resolveAndContain just above.
    if (params.checkpointDir && typeof input.path === 'string') {
      captureSnapshot({
        checkpointDir: params.checkpointDir,
        turnId: params.checkpointTurnId ?? params.clientSessionId,
        filePath: input.path,
      })
    }
  } // ECHO FSM tool gating: block bash/terminal commands unless phase is 'audit' or 'green'.
  // run_readonly_command is intentionally NOT gated here; it is allowed in
  // every FSM phase and enforces read-only safety in its own handler.
  // FID-2026-0725-085 BUG-004: FSM phase check runs FIRST (more actionable error).
  if (
    !isDevOverride &&
    toolCall.toolName === 'run_terminal_command' &&
    !['audit', 'green'].includes(agentState.fsmPhase ?? 'idle')
  ) {
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` is only available during AUDIT or GREEN phases. Current phase: ${agentState.fsmPhase}. Call transition_phase to enter AUDIT or GREEN first.`,
    })
    return previousToolCallFinished
  }

  // FID-2026-0725-085 BUG-006: Log warning when devMode bypasses safety restrictions.
  if (
    isDevOverride &&
    (toolCall.toolName === 'write_file' ||
      toolCall.toolName === 'str_replace' ||
      toolCall.toolName === 'apply_patch' ||
      toolCall.toolName === 'run_terminal_command')
  ) {
    logger.debug(
      { toolName, fsmPhase: agentState.fsmPhase },
      `DEV MODE: ${toolName} bypassing FSM phase gating`,
    )
  }

  // FID-2026-0802-005 L11: `sequentialthinking` authorization derives from the
  // toolNames allowlist gate above (only the Thinker declares it) instead of
  // an `id.startsWith('thinker')` naming-convention check — capability is no
  // longer coupled to an agent ID string (FID-005 "identical by construction").

  // FID-2026-07-27-001: Evaluate tool call against the sandbox policy after
  // FSM and agent-restriction gating, but before streaming the tool_call event
  // or invoking the handler. devMode bypasses the sandbox (logged below).
  if (!isDevOverride) {
    if (!params.fileContext?.projectRoot) {
      logger.warn(
        { toolName },
        'Sandbox check skipped: fileContext.projectRoot is missing. This is a configuration error and may allow unsafe tool calls.',
      )
    } else {
      const sandboxPolicy = createDefaultSandboxPolicy(
        params.fileContext.projectRoot,
        params.fileContext.permissionMode as SandboxPermissionMode | undefined,
      )
      const sandboxDecision = evaluateToolCall({
        toolName: toolCall.toolName,
        // C1: same safe narrowing as the write gate — validated input only.
        input: toolCall.input as Record<string, JSONValue>,
        policy: sandboxPolicy,
      })
      if (sandboxDecision.type === 'deny') {
        onResponseChunk({
          type: 'error',
          message: `Tool \`${toolName}\` was blocked by the sandbox: ${sandboxDecision.reason}`,
        })
        return previousToolCallFinished
      }
      if (sandboxDecision.type === 'prompt') {
        // Phase 1: no interactive TUI permission modal yet. Downgrade to deny
        // in headless mode. Future work will surface a permission request event.
        logger.debug(
          { toolName, reason: sandboxDecision.reason },
          'Sandbox prompt decision downgraded to deny in headless mode',
        )
        onResponseChunk({
          type: 'error',
          message: `Tool \`${toolName}\` requires approval: ${sandboxDecision.reason}. Run with permission mode \`unsafe\` or re-run interactively when supported.`,
        })
        return previousToolCallFinished
      }
    }
  }

  // NOTE: Future improvement: allow tools to provide a validation function and move this logic into the spawn_agents validation function.
  // Pre-validate spawn_agents to filter out non-existent agents before streaming
  let effectiveInput: Record<string, JSONValue> = toolCall.input
  if (toolName === 'spawn_agents') {
    // FID-2026-0723-004: Some models stringify the `agents` array. Attempt to
    // parse it back into an array before validation so the agent gets a clear
    // error instead of a silent schema failure.
    if (typeof effectiveInput.agents === 'string') {
      try {
        const parsed = toJSONValue(JSON.parse(effectiveInput.agents))
        if (!Array.isArray(parsed)) {
          onResponseChunk({
            type: 'error',
            message: `Invalid parameters for spawn_agents: the "agents" argument must be an array of objects, but received a string that parsed to a non-array. Expected shape: { "agents": [{ "agent_type": string, "prompt"?: string, "params"?: object }] }. Re-issue the tool call with the full arguments object and properly escaped string values.`,
          })
          return previousToolCallFinished
        }
        effectiveInput = { ...effectiveInput, agents: parsed as JSONValue }
      } catch (parseError) {
        onResponseChunk({
          type: 'error',
          message: `Invalid parameters for spawn_agents: the "agents" argument must be an array of objects, but received a string. JSON.parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}. Expected shape: { "agents": [{ "agent_type": string, "prompt"?: string, "params"?: object }] }. Re-issue the tool call with the full arguments object and properly escaped string values.`,
        })
        return previousToolCallFinished
      }
    }
    const agents = effectiveInput.agents
    if (Array.isArray(agents)) {
      // FID-2026-0802-005 H4: validation delegates to the single shared
      // resolver (resolveSpawnableAgent) used by the spawn handlers — no more
      // duplicated getMatchingSpawn + getAgentTemplate per agent. The handler
      // still re-resolves via validateAndGetAgentTemplate as defense in depth.
      const validationResults = await Promise.allSettled(
        agents.map(async (agent) => {
          if (!isJSONObject(agent)) {
            return { valid: false as const, error: 'Invalid agent entry' }
          }
          const agentTypeStr = agent.agent_type
          if (typeof agentTypeStr !== 'string' || !agentTypeStr) {
            return {
              valid: false as const,
              error: 'Agent entry missing agent_type',
            }
          }

          const resolved = await resolveSpawnableAgent({
            agentTypeStr,
            parentAgentTemplate: agentTemplate,
            localAgentTemplates: params.localAgentTemplates,
            fetchAgentFromDatabase: params.fetchAgentFromDatabase,
            databaseAgentCache: params.databaseAgentCache,
            logger,
            apiKey: params.apiKey,
          })
          if (!resolved.ok) {
            if (toolNames.includes(agentTypeStr as ToolName)) {
              return {
                valid: false as const,
                error: `"${agentTypeStr}" is a tool, not an agent. Call it directly as a tool instead of wrapping it in spawn_agents.`,
              }
            }
            if (resolved.code === 'not-spawnable') {
              return {
                valid: false as const,
                error: `Agent "${agentTypeStr}" is not available to spawn`,
              }
            }
            if (resolved.code === 'load-failed') {
              return {
                valid: false as const,
                error: `Agent "${agentTypeStr}" could not be loaded`,
              }
            }
            return {
              valid: false as const,
              error: `Agent "${agentTypeStr}" does not exist`,
            }
          }

          return { valid: true as const, agent }
        }),
      )

      const validAgents: Array<Record<string, JSONValue>> = []
      const errors: string[] = []

      for (const result of validationResults) {
        if (result.status === 'rejected') {
          errors.push('Agent validation failed unexpectedly')
        } else if (result.value.valid) {
          validAgents.push(result.value.agent)
        } else {
          errors.push(result.value.error)
        }
      }

      if (errors.length > 0) {
        if (validAgents.length === 0) {
          const errorMsg = `Failed to spawn agents: ${errors.join('; ')}`
          onResponseChunk({ type: 'error', message: errorMsg })
          logger.debug(
            { toolName, errors },
            'All agents in spawn_agents are invalid, not streaming tool call',
          )
          return previousToolCallFinished
        }
        const errorMsg = `Some agents could not be spawned: ${errors.join('; ')}. Proceeding with valid agents only.`
        onResponseChunk({ type: 'error', message: errorMsg })
        effectiveInput = { ...effectiveInput, agents: validAgents }
      }
    }
  }

  // FID-2026-0802-005 H7: abort gate — never stream/push a tool call or
  // invoke a handler after the run has been aborted. Prevents orphaned
  // tool_calls (no matching tool_result) from entering message history,
  // which providers reject. The spawn_agents pre-validation above awaits, so
  // an abort can land inside this window.
  if (params.signal.aborted) {
    return previousToolCallFinished
  }

  // Only emit tool_call event after permission check passes
  // FID-2026-0718-009: emit activity indicator (M1 tool_call, M6 research tools).
  // toolActivity mutates agentState.activity + emits a chunk via onResponseChunk.
  toolActivity(agentState, toolName, effectiveInput, onResponseChunk)

  onResponseChunk({
    type: 'tool_call',
    toolCallId,
    toolName,
    input: effectiveInput,
    agentId: agentState.agentId,
    parentAgentId: agentState.parentId,
    includeToolCall: !excludeToolFromMessageHistory,
  })

  // Cast to any to avoid type errors
  const handler = savantCode$1[
    toolName
  ] as unknown as SavantCodeToolHandlerFunction<T>

  // Use effective input for spawn_agents so the handler receives the correct agent types
  const finalToolCall =
    toolName === 'spawn_agents'
      ? { ...toolCall, input: effectiveInput }
      : toolCall

  toolCalls.push(finalToolCall)
  if (!excludeToolFromMessageHistory) {
    toolCallsToAddToMessageHistory.push(finalToolCall)
  }

  // FID-2026-0802-005 C2: the handler is a trust boundary — a thrown or
  // rejected exception must surface as a tool error (driving the existing
  // hadToolCallError retry flow via the error chunk below), never propagate
  // past the executor and fail the entire run (Law 14).
  let toolResultPromise: ReturnType<SavantCodeToolHandlerFunction<T>>
  try {
    toolResultPromise = handler({
      ...params,
      toolCall: finalToolCall,
      previousToolCallFinished,
      writeToClient: onResponseChunk,
      // FID-029: `as SavantCodeToolOutput<...>` casts are accepted pre-existing
      // tech debt. See dev/fids/FID-2026-0719-029-as-cast-tech-debt.md.
      // The runtime SDK returns the raw client-tool result shape; bridging
      // to SavantCodeToolOutput<...> at the conditional closure slot requires
      // this cast. On abort, we return a graceful JSON-tool-result matching
      // composio's missing-runtime fallback pattern (rather than `[]`,
      // which propagated a wrong-shape never[] downstream). The cast uses
      // `T extends ClientToolName ? T : never` to align with the slot's
      // exact conditional type so it satisfies ECHO distribution cleanly.
      requestClientToolCall: async (
        clientToolCall: ClientToolCall<T extends ClientToolName ? T : never>,
      ) => {
        if (params.signal.aborted) {
          return [
            {
              type: 'json',
              value: {
                errorMessage: `Tool call aborted: ${clientToolCall.toolName}`,
              },
            },
          ] as SavantCodeToolOutput<T extends ClientToolName ? T : never>
        }

        const clientToolResult = await requestToolCall({
          userInputId,
          toolName: clientToolCall.toolName,
          input: clientToolCall.input,
        })
        return clientToolResult.output as SavantCodeToolOutput<
          T extends ClientToolName ? T : never
        >
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` failed: ${errorMessage}`,
    })
    logger.error(
      { toolName, errorMessage },
      `Tool \`${toolName}\` threw synchronously: ${errorMessage}`,
    )
    return previousToolCallFinished
  }

  return toolResultPromise.then(
    async ({ output, creditsUsed }) => {
      const toolResult: ToolMessage = {
        role: 'tool',
        toolName,
        toolCallId: toolCall.toolCallId,
        content: output,
      }

      // FID-2026-0718-009: M2 — on tool completion, model reasoning resumes.
      setActivity(
        agentState,
        { kind: 'thinking', startedAt: Date.now() },
        onResponseChunk,
      )

      onResponseChunk({
        type: 'tool_result',
        toolCallId: toolResult.toolCallId,
        toolName: toolResult.toolName,
        output: toolResult.content,
      })

      toolResults.push(toolResult)

      if (!excludeToolFromMessageHistory) {
        toolResultsToAddToMessageHistory.push(toolResult)
      }

      // After tool completes, resolve any pending creditsUsed promise
      if (creditsUsed) {
        onCostCalculated(creditsUsed)
        logger.debug(
          { credits: creditsUsed, totalCredits: agentState.creditsUsed },
          `Added ${creditsUsed} credits from ${toolName} to agent state`,
        )
      }
    },
    async (error) => {
      // FID-2026-0802-005 C2: rejections are caught here and converted into
      // the same retryable tool-error flow instead of failing the run.
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      onResponseChunk({
        type: 'error',
        message: `Tool \`${toolName}\` failed: ${errorMessage}`,
      })
      logger.error(
        { toolName, errorMessage },
        `Tool \`${toolName}\` failed: ${errorMessage}`,
      )
    },
  )
}

export function parseRawCustomToolCall(params: {
  customToolDefs: CustomToolDefinitions
  rawToolCall: {
    toolName: string
    toolCallId: string
    input: JSONValue
  }
  autoInsertEndStepParam?: boolean
}): CustomToolCall | ToolCallError {
  const { customToolDefs, rawToolCall, autoInsertEndStepParam = false } = params
  const toolName = rawToolCall.toolName

  if (
    !(customToolDefs && toolName in customToolDefs) &&
    !toolName.includes(MCP_TOOL_SEPARATOR)
  ) {
    return {
      toolName,
      toolCallId: rawToolCall.toolCallId,
      input: rawToolCall.input,
      error: `Tool ${toolName} not found`,
    }
  }

  const parsedInput = parseStringifiedToolInput(rawToolCall.input, toolName)

  if (typeof parsedInput.input === 'string') {
    return stringInputError(
      toolName,
      rawToolCall.toolCallId,
      parsedInput.parseError,
    )
  }

  const processedParameters: Record<string, JSONValue> = {}
  for (const [param, val] of Object.entries(parsedInput.input ?? {})) {
    processedParameters[param] = val
  }

  // Add the required endsAgentStepParam (cb_easp) parameter with the correct value for this tool if requested
  if (
    autoInsertEndStepParam &&
    customToolDefs?.[toolName]?.endsAgentStep != null
  ) {
    processedParameters[endsAgentStepParam] = customToolDefs[toolName]
      .endsAgentStep as JSONValue
  }

  const rawSchema = customToolDefs?.[toolName]?.inputSchema
  if (rawSchema) {
    const paramsSchema = ensureZodSchema(rawSchema as Record<string, JSONValue>)
    const result = paramsSchema.safeParse(processedParameters)

    if (!result.success) {
      return {
        toolName: toolName,
        toolCallId: rawToolCall.toolCallId,
        input: rawToolCall.input,
        error: `Invalid parameters for ${toolName}: ${JSON.stringify(
          result.error.issues,
          null,
          2,
        )}`,
      }
    }
  }

  const input = JSON.parse(JSON.stringify(parsedInput.input))
  if (endsAgentStepParam in input) {
    delete input[endsAgentStepParam]
  }
  return {
    toolName: toolName,
    input,
    toolCallId: rawToolCall.toolCallId,
  }
}

export async function executeCustomToolCall(
  params: ExecuteToolCallParams<string>,
): Promise<void> {
  const {
    toolName,
    input,
    autoInsertEndStepParam = false,
    excludeToolFromMessageHistory = false,
    fromHandleSteps = false,

    agentState,
    agentTemplate,
    fileContext,
    logger,
    onResponseChunk,
    previousToolCallFinished,
    requestToolCall,
    toolCallId,
    toolCalls,
    toolCallsToAddToMessageHistory,
    toolResults,
    toolResultsToAddToMessageHistory,
    userInputId,
  } = params
  const toolCall: CustomToolCall | ToolCallError = parseRawCustomToolCall({
    // FID-2026-0802-005 H8: prefer the step-built custom tool data passed down
    // from loopAgentSteps (built once per step); fall back to the previous
    // per-call getMCPToolData rebuild (cloneDeep + potential MCP listTools)
    // only when the caller did not provide it.
    customToolDefs:
      params.customToolDefinitions ??
      (await getMCPToolData({
        ...params,
        toolNames: agentTemplate.toolNames,
        mcpServers: agentTemplate.mcpServers,
        writeTo: cloneDeep(fileContext.customToolDefinitions),
      })),
    rawToolCall: {
      toolName,
      toolCallId: toolCallId ?? generateCompactId(),
      input: input as JSONValue,
    },
    autoInsertEndStepParam,
  })

  // Dev override: bypass agent tool restrictions for custom tools when devMode is active
  const isDevOverride = fileContext.devMode === true

  // Filter out restricted tools - emit error instead of tool call/result
  // This prevents the CLI from showing tool calls that the agent doesn't have permission to use
  if (
    !isDevOverride &&
    toolCall.toolName &&
    !agentTemplate.toolNames.includes(toolCall.toolName) &&
    !fromHandleSteps &&
    !(
      toolCall.toolName.includes(MCP_TOOL_SEPARATOR) &&
      toolCall.toolName.split(MCP_TOOL_SEPARATOR)[0] in agentTemplate.mcpServers
    )
  ) {
    // Emit an error event instead of tool call/result pair
    // The stream parser will convert this to a user message for proper API compliance
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` is not currently available. Make sure to only use tools listed in the system instructions.`,
    })
    return previousToolCallFinished
  }

  if ('error' in toolCall) {
    const formattedInput = formatValueForError(input)
    onResponseChunk({
      type: 'error',
      message: `${toolCall.error}\n\nOriginal tool call input:\n${formattedInput}`,
    })
    logger.debug(
      { toolCall, error: toolCall.error },
      `${toolName} error: ${toolCall.error}`,
    )
    return previousToolCallFinished
  }

  // Only emit tool_call event after permission check passes
  onResponseChunk({
    type: 'tool_call',
    toolCallId: toolCall.toolCallId,
    toolName,
    input: toolCall.input,
    // Only include agentId for subagents (agents with a parent)
    ...(agentState?.parentId && { agentId: agentState.agentId }),
    // Include includeToolCall flag if explicitly set to false
    ...(excludeToolFromMessageHistory && { includeToolCall: false }),
  })

  toolCalls.push(toolCall)
  if (!excludeToolFromMessageHistory) {
    toolCallsToAddToMessageHistory.push(toolCall)
  }

  return previousToolCallFinished
    .then(async () => {
      if (params.signal.aborted) {
        return null
      }

      const toolName = toolCall.toolName.includes(MCP_TOOL_SEPARATOR)
        ? toolCall.toolName
            .split(MCP_TOOL_SEPARATOR)
            .slice(1)
            .join(MCP_TOOL_SEPARATOR)
        : toolCall.toolName
      const clientToolResult = await requestToolCall({
        userInputId,
        toolName,
        input: toolCall.input,
        mcpConfig: toolCall.toolName.includes(MCP_TOOL_SEPARATOR)
          ? agentTemplate.mcpServers[
              toolCall.toolName.split(MCP_TOOL_SEPARATOR)[0]
            ]
          : undefined,
      })
      return clientToolResult.output satisfies ToolResultOutput[]
    })
    .then(
      (result) => {
        if (!result) {
          return
        }
        const toolResult = {
          role: 'tool',
          toolName,
          toolCallId: toolCall.toolCallId,
          content: result,
        } satisfies ToolMessage
        logger.debug(
          { input, toolResult },
          `${toolName} custom tool call & result (${toolResult.toolCallId})`,
        )
        onResponseChunk({
          type: 'tool_result',
          toolName: toolResult.toolName,
          toolCallId: toolResult.toolCallId,
          output: toolResult.content,
        })

        toolResults.push(toolResult)

        if (!excludeToolFromMessageHistory) {
          toolResultsToAddToMessageHistory.push(toolResult)
        }

        return
      },
      async (error) => {
        // FID-2026-0802-005 C2 (custom-tool parity): a rejected custom/MCP
        // tool request must surface as a tool error (driving the
        // hadToolCallError retry flow) instead of rejecting
        // previousToolCallFinished and failing the whole run — the same
        // failure mode C2 fixed for native handlers.
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        onResponseChunk({
          type: 'error',
          message: `Tool \`${toolName}\` failed: ${errorMessage}`,
        })
        logger.error(
          { toolName, errorMessage },
          `Tool \`${toolName}\` failed: ${errorMessage}`,
        )
      },
    )
}

/**
 * Checks if a tool name matches a spawnable agent and returns the transformed
 * spawn_agents input if so. Returns null if not an agent tool call.
 */
export function tryTransformAgentToolCall(params: {
  toolName: string
  input: Record<string, JSONValue>
  spawnableAgents: AgentTemplateType[]
}): { toolName: 'spawn_agents'; input: Record<string, JSONValue> } | null {
  const { toolName, input, spawnableAgents } = params

  const matchesAgentToolName = (agentType: AgentTemplateType) =>
    getAgentToolName(agentType) === toolName ||
    getAgentShortName(agentType) === toolName

  // Find the full agent type for this direct-call alias.
  const fullAgentType = spawnableAgents.find(matchesAgentToolName)
  if (!fullAgentType) {
    return null
  }

  // Convert to spawn_agents call - input already has prompt and params as top-level fields
  // (consistent with spawn_agents schema)
  const agentEntry: Record<string, JSONValue> = {
    agent_type: fullAgentType,
  }
  if (typeof input.prompt === 'string') {
    agentEntry.prompt = input.prompt
  }
  if (input.params && typeof input.params === 'object') {
    agentEntry.params = input.params
  }
  const spawnAgentsInput = {
    agents: [agentEntry],
  }

  return { toolName: 'spawn_agents', input: spawnAgentsInput }
}
