import { mapValues } from 'lodash'

import {
  validateAndGetAgentTemplate,
  validateAgentInput,
  executeSubagent,
  createAgentState,
  extractSubagentContextParams,
  withParentModel,
} from './spawn-agent-utils'
import { getOrCreateEnforcement } from '../../../echo/enforcement'
import { appendGroundingRefresh } from '../../../echo/grounding'
import { getOrCreateProvenance } from '../../../provenance'
import { extractVerdictText } from '../../../provenance/verdict'
import { filterToolSet } from '../../../tools/filter-tool-set'

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
    spawnParams,
    agentTemplate: inlineTemplate,
    parentAgentState,
    agentState: childAgentState,
    fingerprintId,
    parentSystemPrompt: system,
    parentTools: inheritedTools,
    onResponseChunk: (chunk) => {
      // Inherits parent's onResponseChunk, except for context-pruner (NOTE: add an option for it to be silent?)
      if (agentType !== 'context-pruner') {
        writeToClient(chunk)
      }
    },
    clearUserPromptMessagesAfterResponse: false,
  })

  // FID-2026-0813-004: ZTAP verdict binding (inline spawn path). The
  // Verifier/Adversary verdict is the child's final output; bind it to every
  // open receipt of the session as a signed verbatim payload (D7).
  if (agentType === 'verifier' || agentType === 'adversary') {
    const verdictText = extractVerdictText(result.agentState)
    if (verdictText) {
      const provenance = getOrCreateProvenance(parentAgentState, {
        projectRoot: params.fileContext?.projectRoot ?? '.',
      })
      void provenance
        .bindVerdict({
          phase: agentType === 'verifier' ? 'audit' : 'adversarial',
          agentId: childAgentState.agentId,
          agentType,
          verdictText,
        })
        .then((receipts) => {
          for (const receipt of receipts) {
            writeToClient({
              type: 'provenance_receipt',
              sessionId: receipt.sessionId,
              seq: receipt.seq,
              phase: agentType === 'verifier' ? 'audit' : 'adversarial',
              status: receipt.status,
              signed: receipt.signatures.length > 0,
              receipt,
              verdictText,
            })
          }
        })
        .catch(() => {
          // Best-effort: a failed binding never fails the spawn.
        })
    }
  }

  // Update parent agent state to reflect shared message history. The
  // context-pruner replaces history through set_messages in the child; append
  // the freshness refresh at the parent mutation boundary so it cannot be
  // discarded by that replacement.
  const prunerMessagesRemoved =
    agentType === 'context-pruner'
      ? Math.max(
          0,
          parentAgentState.messageHistory.length -
            result.agentState.messageHistory.length,
        )
      : 0
  parentAgentState.messageHistory = result.agentState.messageHistory
  if (agentType === 'context-pruner' && !parentAgentState.parentId) {
    appendGroundingRefresh(
      parentAgentState,
      getOrCreateEnforcement(parentAgentState).recordHistoryReplacement()
        .refreshText,
    )
    // FID-2026-0814-001: live pruner result feedback + re-spawn cooldown
    // stamp. The child's history is now the compacted history; estimate tokens
    // freed with the same convention as micro-compact (~200 tokens per removed
    // message). The next step boundary recomputes the accurate window-relative
    // percent, and the anti-thrash score at that boundary is authoritative.
    parentAgentState.lastPrunerCompletionAt = Date.now()
    const prunerMaxContextLength = parentAgentState.maxContextLength ?? 200_000
    const prunerTokensSaved = prunerMessagesRemoved * 200
    const prunerPercentUsed = Math.round(
      ((parentAgentState.contextTokenCount ?? 0) / prunerMaxContextLength) *
        100,
    )
    if (prunerTokensSaved > 0) {
      parentAgentState.compactionStatus = {
        phase: 'pruned',
        tokensSaved: prunerTokensSaved,
        percentUsed: prunerPercentUsed,
      }
    } else if (
      !(spawnParams as { foldOldestExchange?: boolean } | undefined)
        ?.foldOldestExchange
    ) {
      // A real proactive/force compaction that removed nothing is ineffective:
      // surface the warning instead of leaving a stale status. The amortized
      // fold no-ops by design (nothing un-absorbed), so it never overwrites.
      parentAgentState.compactionStatus = {
        phase: 'warning',
        percentUsed: prunerPercentUsed,
      }
    }
  }

  return { output: [{ type: 'json', value: { message: 'Agent spawned.' } }] }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
