import { mapValues } from 'lodash'

import { fireCompactionAttemptForInlineSpawn } from './spawn-agent-inline-precompact'
import {
  applyPrunerPostRunGuards,
  markPrunerBlockedOnCrash,
  resolvePrunerSpawnParams,
} from './spawn-agent-inline-pruner-guards'
import { PRUNER_SUMMARY_BUFFER_CHARS } from './spawn-agent-inline-summary'
import { applyVerdictReceipts } from './spawn-agent-inline-verdict'
import {
  validateAndGetAgentTemplate,
  validateAgentInput,
  executeSubagent,
  createAgentState,
  extractSubagentContextParams,
  resolveChildOutputBudget,
  withParentModel,
} from './spawn-agent-utils'
import { buildInlineSpawnRelay } from './spawn-inline-only'
import { loadRawEvidenceForSpawn } from '../../../evidence/spawn-evidence'
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

  // FID-2026-0909-008 Step 4: same guarded propagation as the spawn_agents
  // path (shared guard — see resolveChildOutputBudget).
  const childOutputBudget = resolveChildOutputBudget(
    agentTemplate,
    parentAgentTemplate,
    params.maxOutputTokens,
  )

  validateAgentInput(agentTemplate, agentType, prompt, spawnParams)

  // FID-2026-0824-024 post-closure amendment: inject operator-configured
  // digest caps (`compression.digestHeadChars/TailChars` → AgentState.
  // digestCaps, stamped by loop-context) into the pruner's spawn params AFTER
  // validation — harness-controlled numbers bypass template schema
  // strictness while model-provided params stay guarded.
  const digestCaps = parentAgentState.digestCaps
  // FID-2026-0914-002: thread the repo root into the pruner's spawn params
  // (same harness-controlled injection as the digest caps — the embedded
  // scope cannot read process/env) so preserved-state paths normalize
  // repo-relative instead of leaking absolute machine paths.
  const projectRoot = params.fileContext?.projectRoot
  const effectiveSpawnParams = resolvePrunerSpawnParams({
    agentType,
    digestCaps,
    projectRoot,
    spawnParams,
  })

  fireCompactionAttemptForInlineSpawn({
    agentType,
    parentAgentState,
    projectRoot,
  })

  // FID-2026-0824-023: bounded capture of streamed summary text.
  let prunerSummaryBuffer = ''

  // Override template for inline agent to share system prompt & message history with parent
  const inlineTemplate = {
    ...agentTemplate,
    includeMessageHistory: true,
    inheritParentSystemPrompt: true,
  }
  const inheritedTools = filterToolSet(parentTools, inlineTemplate.toolNames)

  // FID-2026-0919-027: the inline path is a spawn boundary too.
  const rawEvidenceRecords = await loadRawEvidenceForSpawn({
    agentTemplate,
    spawningAgentState: parentAgentState,
    projectRoot: params.fileContext?.projectRoot,
  })

  // Create child agent state that shares message history with parent
  const childAgentState: AgentState = {
    ...createAgentState(
      agentType,
      inlineTemplate,
      parentAgentState,
      parentAgentState.agentContext,
      params.fileContext?.projectRoot,
      rawEvidenceRecords,
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
    maxOutputTokens: childOutputBudget,
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
    // FID-2026-0822-001 RC4: a crashed inline context-pruner must not leave
    // compactionStatus stuck at 'compacting' forever — emit the truthful
    // blocked state and stamp the attempt BEFORE propagating (moved to
    // spawn-agent-inline-pruner-guards.ts, FID-2026-0915-002 split 11).
    markPrunerBlockedOnCrash({ agentType, parentAgentState })
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

  // Post-run pruner guards (excerpt → LLM semantic upgrade → compaction
  // outcome) — moved to spawn-agent-inline-pruner-guards.ts
  // (FID-2026-0915-002 split 11).
  await applyPrunerPostRunGuards({
    agentType,
    parentAgentState,
    parentAgentTemplate,
    resultAgentState: result.agentState,
    prunerSummaryBuffer,
    previousHistory,
    previousHistoryLength,
    previousTokenEstimate,
    spawnParams,
    projectRoot: params.fileContext?.projectRoot ?? '',
    upgrade: {
      promptAiSdk: params.promptAiSdk,
      model: parentAgentTemplate.model,
      apiKey: params.apiKey,
      runId: parentAgentState.runId ?? 'NULL',
      clientSessionId: params.clientSessionId,
      fingerprintId: params.fingerprintId,
      userInputId,
      userId: params.userId,
      signal: params.signal,
      logger,
      sendAction: params.sendAction,
      trackEvent: params.trackEvent,
    },
    writeToClient,
  })

  // FID-2026-0919-027: relay the child's real output (the historical constant
  // dropped a structured_output child's artifact — see buildInlineSpawnRelay).
  return {
    output: [
      {
        type: 'json',
        value: buildInlineSpawnRelay({
          agentType,
          outputMode: inlineTemplate.outputMode,
          output: result.output,
        }),
      },
    ],
  }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
