/** FID-2026-0824-023 stream-routing: bounded capture of the pruner's streamed summary text. */
const PRUNER_SUMMARY_BUFFER_CHARS = 8_000
// FID-2026-0824-023 V2 completion: persist half the buffer so the
// CompactionSignal expander can reveal a genuinely full summary excerpt.
const PRUNER_SUMMARY_EXCERPT_CHARS = 4_000

const CONVERSATION_SUMMARY_OPEN = '<conversation_summary>'
const CONVERSATION_SUMMARY_CLOSE = '</conversation_summary>'
const HISTORICAL_MEMORY_OPEN = '<historical_memory>'
const HISTORICAL_MEMORY_CLOSE = '</historical_memory>'
const COMPACTION_SUMMARY_OPEN = '<compaction-summary>'
const COMPACTION_SUMMARY_CLOSE = '</compaction-summary>'
const STRUCTURED_STATE_OPEN = '<structured_state>'
const STRUCTURED_STATE_CLOSE = '</structured_state>'

/**
 * Extract the pruner's summary text from the compacted history's memory
 * message. The context-pruner writes the summary into
 * `<conversation_summary>` → `<historical_memory>` → `<compaction-summary>`
 * as `finalMessages[0]` (summary-assembly.ts) — the same single source of
 * truth the pruner itself parses via extractSummaryContent. Mirrors that
 * tag-walking order so the transcript block surfaces the EXACT text the
 * pruner embedded (FID-2026-0828-001, Law 13). Falls back to '' when no
 * summary message is present or the compaction-summary wrapper is absent.
 *
 * This is the production source of truth for a PROGRAMMATIC context-pruner
 * (handleSteps generator): it never streams text through onResponseChunk,
 * so the FID-2026-0824-023 streamed-text buffer stays empty and the summary
 * must be recovered from the history it emitted.
 */
export function extractPrunerSummaryFromHistory(
  messageHistory: readonly unknown[],
): string {
  for (const raw of messageHistory) {
    if (raw === null || typeof raw !== 'object') continue
    const message = raw as {
      role?: unknown
      content?: unknown
    }
    if (message.role !== 'user') continue
    let text = ''
    const content = message.content
    if (typeof content === 'string') {
      text = content
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (
          part !== null &&
          typeof part === 'object' &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          text += (part as { text?: string }).text
        }
      }
    }
    const convMatch = text.match(
      new RegExp(
        `${CONVERSATION_SUMMARY_OPEN}([\\s\\S]*?)${CONVERSATION_SUMMARY_CLOSE}`,
      ),
    )
    if (!convMatch) continue
    const memoryMatch = convMatch[1].match(
      new RegExp(
        `${HISTORICAL_MEMORY_OPEN}([\\s\\S]*?)${HISTORICAL_MEMORY_CLOSE}`,
      ),
    )
    const memoryContent = memoryMatch ? memoryMatch[1] : convMatch[1]
    const summaryMatch = memoryContent.match(
      new RegExp(
        `${COMPACTION_SUMMARY_OPEN}([\\s\\S]*?)${COMPACTION_SUMMARY_CLOSE}`,
      ),
    )
    if (summaryMatch) {
      // The pruner's structured block is framed in XML wire tags intended for
      // the MODEL's history (<structured_state>…</structured_state>). For a
      // user-facing transcript block they are formatting noise, so unwrap them
      // the same way the pruner's own extractSummaryContent unwraps its wire
      // tags — the interior (headings, bullets, preserved state) is the real
      // readable summary. stripStructuredStateWrappers keeps everything else,
      // including the '---' assigned-user/assistant budget section that follows.
      return stripStructuredStateWrappers(summaryMatch[1]).trim()
    }
  }
  return ''
}

/**
 * Remove the <structured_state> and </structured_state> framing tags, keeping
 * the interior (and any surrounding separator + budgeted-entries text) intact.
 * Tag order is deterministic (structured-summary.ts buildPreservedStateSection
 * closes the block last), so a targeted strip is safe and never deletes the
 * readable content between the tags.
 */
export function stripStructuredStateWrappers(text: string): string {
  return text.replace(
    new RegExp(`${STRUCTURED_STATE_OPEN}[\\s\\S]*?${STRUCTURED_STATE_CLOSE}`),
    (match) =>
      match.slice(STRUCTURED_STATE_OPEN.length, -STRUCTURED_STATE_CLOSE.length),
  )
}

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
import {
  appendCompactionInventory,
  buildCompactionModelNotice,
  describeRemovedToolItem,
  diffRemovedSpans,
} from '../../../evidence/inventory'
import { getOrCreateProvenance } from '../../../provenance'
import { extractVerdictText } from '../../../provenance/verdict'
import { filterToolSet } from '../../../tools/filter-tool-set'
import { withSystemTags } from '../../../util/messages'
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
  const previousHistoryLength = parentAgentState.messageHistory.length
  const previousTokenEstimate = countTokensMessagesCached(
    parentAgentState.messageHistory,
  )
  // FID-2026-0824-025/-027 post-closure amendment: capture the PRE-history
  // reference so this replacement boundary can diff removed spans/items by
  // object identity (kept messages keep identity across set_messages).
  const previousHistory = parentAgentState.messageHistory
  parentAgentState.messageHistory = result.agentState.messageHistory
  if (agentType === 'context-pruner' && !parentAgentState.parentId) {
    appendGroundingRefresh(
      parentAgentState,
      getOrCreateEnforcement(parentAgentState).recordHistoryReplacement()
        .refreshText,
    )
    // FID-2026-0814-001: live pruner result feedback + re-spawn cooldown
    // stamp. FID-2026-0821-001 P0-2: runtime-emitted terminal truth — recount
    // the compacted history locally (provider usage is stale after
    // truncation) and emit an explicit `pruned` vs `ineffective` phase so the
    // CLI records outcomes verbatim instead of inferring them from
    // transitions. The next step boundary recomputes the accurate
    // window-relative percent, and the anti-thrash score at that boundary is
    // authoritative.
    parentAgentState.lastPrunerCompletionAt = Date.now()
    const recountedTokens = countTokensMessagesCached(
      parentAgentState.messageHistory,
    )
    const prunerMessagesRemoved = Math.max(
      0,
      previousHistoryLength - parentAgentState.messageHistory.length,
    )
    const prunerTokensSaved = Math.max(
      0,
      previousTokenEstimate - recountedTokens,
    )
    const prunerMaxContextLength = parentAgentState.maxContextLength ?? 200_000
    parentAgentState.contextTokenCount = recountedTokens
    const prunerPercentUsed = Math.round(
      (recountedTokens / prunerMaxContextLength) * 100,
    )
    // FID-2026-0824-027: inventory row + bounded model-facing notice at the
    // replacement boundary (fail-open; never carries payloads).
    // FID-2026-0824-025/-027 post-closure amendment: region indices +
    // bounded per-item rows derived by identity diff at this boundary
    // (append omits empty arrays, keeping rows minimal).
    const removalDiff = diffRemovedSpans({
      prev: previousHistory,
      next: parentAgentState.messageHistory,
      describeItem: describeRemovedToolItem,
    })
    void appendCompactionInventory({
      projectRoot: params.fileContext?.projectRoot ?? '',
      runId: parentAgentState.runId ?? parentAgentState.agentId,
      layer: 'auto',
      removedMessages: prunerMessagesRemoved,
      tokensSaved: prunerTokensSaved,
      percentUsed: prunerPercentUsed,
      regions: removalDiff.regions,
      items: removalDiff.items,
    })
    parentAgentState.messageHistory.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: withSystemTags(buildCompactionModelNotice('auto')),
        },
      ],
      tags: ['COMPACTION_NOTICE'],
    })
    const autoMetrics = parentAgentState.compactionMetrics ?? {
      events: 0,
      tokensSaved: 0,
    }
    parentAgentState.compactionMetrics = {
      events: autoMetrics.events + 1,
      tokensSaved: autoMetrics.tokensSaved + prunerTokensSaved,
    }

    // FID-2026-0824-023 stream-routing: persist the bounded summary excerpt
    // + removed-region counts so CompactionSignal surfaces WHAT was compacted.
    // FID-2026-0828-001: hoisted so the transcript event below carries the
    // SAME excerpt (single source of truth, Law 13). The context-pruner is a
    // PROGRAMMATIC agent — it never streams text through onResponseChunk, so
    // the streamed-text buffer is empty here; recover the summary from the
    // compacted history's conversation_summary memory message instead (the
    // exact text the pruner embedded). The buffer remains the fallback for
    // any future streaming pruner variant.
    const streamedExcerpt = prunerSummaryBuffer.slice(
      -PRUNER_SUMMARY_EXCERPT_CHARS,
    )
    const prunerSummaryExcerpt =
      streamedExcerpt.trim().length > 0
        ? streamedExcerpt
        : extractPrunerSummaryFromHistory(result.agentState.messageHistory)
    parentAgentState.lastCompactionReport = {
      summaryExcerpt: prunerSummaryExcerpt,
      removedMessages: prunerMessagesRemoved,
      ...(prunerTokensSaved > 0
        ? { tokensSaved: prunerTokensSaved, percentUsed: prunerPercentUsed }
        : {}),
    }
    // FID-2026-0828-001: the post-compaction summary crosses the wire as a
    // structured event BEFORE the run resolves — the manual /compact turn's
    // visible end-of-turn output (compact-and-stop) and a mid-turn block for
    // auto-compaction (the run proceeds afterward). Fired only for real
    // compactions with a non-empty summary — the same condition that records
    // the `pruned` phase; fold no-ops and summary-less completions stay
    // silent. Direct writeToClient: the onResponseChunk override diverts only
    // the pruner's streamed text chunks, not this structured notice.
    if (prunerMessagesRemoved > 0 && prunerSummaryExcerpt.trim().length > 0) {
      writeToClient({
        type: 'compaction_summary',
        summary: prunerSummaryExcerpt,
        removedMessages: prunerMessagesRemoved,
        ...(prunerTokensSaved > 0
          ? { tokensSaved: prunerTokensSaved, percentUsed: prunerPercentUsed }
          : {}),
      })
    }
    if (prunerMessagesRemoved > 0 && prunerTokensSaved > 0) {
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
      // emit the explicit terminal phase instead of leaving a stale status.
      // The amortized fold no-ops by design (nothing un-absorbed), so it
      // never overwrites.
      parentAgentState.compactionStatus = {
        phase: 'ineffective',
        percentUsed: prunerPercentUsed,
      }
    }
  }

  return { output: [{ type: 'json', value: { message: 'Agent spawned.' } }] }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
