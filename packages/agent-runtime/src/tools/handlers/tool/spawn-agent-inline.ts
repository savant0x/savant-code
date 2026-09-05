import { mapValues } from 'lodash'

import { applyPrunerCompactionOutcome } from './spawn-agent-inline-pruner-outcome'
import {
  PRUNER_SUMMARY_BUFFER_CHARS,
  PRUNER_SUMMARY_EXCERPT_CHARS,
  extractPrunerSummaryFromHistory,
} from './spawn-agent-inline-summary'
import { applyVerdictReceipts } from './spawn-agent-inline-verdict'
import {
  validateAndGetAgentTemplate,
  validateAgentInput,
  executeSubagent,
  createAgentState,
  extractSubagentContextParams,
  withParentModel,
} from './spawn-agent-utils'
import { filterToolSet } from '../../../tools/filter-tool-set'
import { countTokensMessagesCached } from '../../../util/token-counter'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

type ToolName = 'spawn_agent_inline'
export const handleSpawnAgentInline = (async (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SavantCodeToolCall<ToolName>

    agentState: AgentState
    agentTemplate: AgentTemplate
    clientSessionId: string
    fileContext: ProjectFileContext
    fingerprintId: string
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
    system: string
    tools: ToolSet
    userId: string | undefined
    userInputId: string
    writeToClient: (chunk: string | PrintModeEvent) => void
  } & ParamsExcluding<
    typeof executeSubagent,
    | 'userInputId'
    | 'prompt'
    | 'spawnParams'
    | 'agentTemplate'
    | 'parentAgentState'
    | 'agentState'
    | 'parentSystemPrompt'
    | 'parentTools'
    | 'onResponseChunk'
    | 'clearUserPromptMessagesAfterResponse'
    | 'fingerprintId'
    | 'propagation'
  >,
): Promise<{ output: SavantCodeToolOutput<ToolName> }> => {
  const {
    previousToolCallFinished,
    toolCall,

    agentState: parentAgentState,
    agentTemplate: parentAgentTemplate,
    fingerprintId,
    system,
    tools: parentTools,
    userInputId,
    writeToClient,
    logger,
  } = params
  const {
    agent_type: agentTypeStr,
    prompt,
    params: spawnParams,
  } = toolCall.input

  await previousToolCallFinished

  const { agentTemplate: childTemplate, agentType } =
    await validateAndGetAgentTemplate({
      agentTypeStr,
      parentAgentTemplate,
      localAgentTemplates: params.localAgentTemplates,
      logger,
      fetchAgentFromDatabase: params.fetchAgentFromDatabase,
      databaseAgentCache: params.databaseAgentCache,
      apiKey: params.apiKey,
    })

  // Inherit the parent's model so inline subagents respect the user's selected model.
  const agentTemplate = withParentModel(childTemplate, parentAgentTemplate)

  validateAgentInput(agentTemplate, agentType, prompt, spawnParams)

  // FID-2026-0824-024 post-closure amendment: inject operator-configured
  // digest caps (`compression.digestHeadChars/TailChars` → AgentState.
  // digestCaps, stamped by loop-context) into the pruner's spawn params AFTER
  // validation — harness-controlled numbers bypass template schema
  // strictness while model-provided params stay guarded.
  const digestCaps = parentAgentState.digestCaps
  const effectiveSpawnParams =
    agentType === 'context-pruner' && digestCaps
      ? {
          ...(spawnParams ?? {}),
          ...(digestCaps.headChars !== undefined
            ? { digestHeadChars: digestCaps.headChars }
            : {}),
          ...(digestCaps.tailChars !== undefined
            ? { digestTailChars: digestCaps.tailChars }
            : {}),
        }
      : spawnParams

  // FID-2026-0824-023: bounded capture of streamed summary text.
  let prunerSummaryBuffer = ''

  // Override template for inline agent to share system prompt & message history with parent
  const inlineTemplate = {
    ...agentTemplate,
    includeMessageHistory: true,
    inheritParentSystemPrompt: true,
  }
  const inheritedTools = filterToolSet(parentTools, inlineTemplate.toolNames)

  // Create child agent state that shares message history with parent
  const childAgentState: AgentState = {
    ...createAgentState(
      agentType,
      inlineTemplate,
      parentAgentState,
      parentAgentState.agentContext,
      params.fileContext?.projectRoot,
    ),
    systemPrompt: system,
    toolDefinitions: mapValues(inheritedTools, (tool) => ({
      description: tool.description,
      inputSchema: tool.inputSchema as {},
    })),
  }

  // Extract common context params to avoid bugs from spreading all params
  const contextParams = extractSubagentContextParams({
    ...params,
    agentState: parentAgentState,
  })
  const propagation = contextParams.propagation
  if (!propagation) {
    throw new Error('Subagent propagation context is missing.')
  }

  const result = await executeSubagent({
    propagation,
    ...contextParams,

    // Spawn-specific params
    ancestorRunIds: parentAgentState.ancestorRunIds,
    userInputId: `${userInputId}-inline-${agentType}${childAgentState.agentId}`,
    prompt: prompt || '',
    spawnParams: effectiveSpawnParams,
    agentTemplate: inlineTemplate,
    parentAgentState,
    agentState: childAgentState,
    fingerprintId,
    parentSystemPrompt: system,
    parentTools: inheritedTools,
    onResponseChunk: (chunk) => {
      // FID-2026-0824-023 stream-routing: context-pruner chunks feed the
      // bounded summary buffer instead of being dropped; everything else
      // inherits the parent's chunk path unchanged.
      if (agentType === 'context-pruner') {
        if (typeof chunk === 'string') {
          prunerSummaryBuffer = (prunerSummaryBuffer + chunk).slice(
            -PRUNER_SUMMARY_BUFFER_CHARS,
          )
        }
        return
      }
      writeToClient(chunk)
    },
    clearUserPromptMessagesAfterResponse: false,
  }).catch((error: unknown) => {
    // FID-2026-0822-001 RC4: a crashed inline context-pruner used to leave
    // compactionStatus stuck at 'compacting' forever - the terminal-phase
    // emission below runs only on success. Emit the truthful blocked state
    // and stamp the attempt BEFORE propagating, so the CLI panel and the
    // anti-thrash cooldown see terminal reality instead of eternal silence.
    if (agentType === 'context-pruner' && !parentAgentState.parentId) {
      parentAgentState.lastPrunerCompletionAt = Date.now()
      parentAgentState.compactionStatus = {
        phase: 'blocked',
        percentUsed: Math.round(
          (parentAgentState.contextTokenCount /
            (parentAgentState.maxContextLength ?? 200_000)) *
            100,
        ),
        blockReason: 'pruner-unavailable',
      }
    }
    throw error
  })

  // FID-2026-0813-004: ZTAP verdict binding (inline spawn path). The
  // Verifier/Adversary verdict is the child's final output; bind it to every
  // open receipt of the session as a signed verbatim payload (D7).
  if (agentType === 'verifier' || agentType === 'adversary') {
    applyVerdictReceipts({
      agentType,
      childAgentId: childAgentState.agentId,
      resultAgentState: result.agentState,
      parentAgentState,
      projectRoot: params.fileContext?.projectRoot ?? '.',
      writeToClient,
    })
  }

  // Update parent agent state to reflect shared message history. The
  // context-pruner replaces history through set_messages in the child; append
  // the freshness refresh at the parent mutation boundary so it cannot be
  // discarded by that replacement.
  const previousHistoryLength = parentAgentState.messageHistory.length
  const previousTokenEstimate = countTokensMessagesCached(
    parentAgentState.messageHistory,
  )
  // FID-2026-0824-025/-027 post-closure amendment: capture the PRE-history
  // reference so this replacement boundary can diff removed spans/items by
  // object identity (kept messages keep identity across set_messages).
  const previousHistory = parentAgentState.messageHistory
  parentAgentState.messageHistory = result.agentState.messageHistory
  const streamedExcerpt = prunerSummaryBuffer.slice(
    -PRUNER_SUMMARY_EXCERPT_CHARS,
  )
  const prunerSummaryExcerpt =
    streamedExcerpt.trim().length > 0
      ? streamedExcerpt
      : extractPrunerSummaryFromHistory(result.agentState.messageHistory)
  if (agentType === 'context-pruner' && !parentAgentState.parentId) {
    applyPrunerCompactionOutcome({
      parentAgentState,
      previousHistory,
      previousHistoryLength,
      previousTokenEstimate,
      summaryExcerpt: prunerSummaryExcerpt,
      spawnParams,
      projectRoot: params.fileContext?.projectRoot ?? '',
      writeToClient,
    })
  }

  return { output: [{ type: 'json', value: { message: 'Agent spawned.' } }] }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
