import { getOrCreateEnforcement } from '../../../echo/enforcement'
import { appendGroundingRefresh } from '../../../echo/grounding'
import {
  appendCompactionInventory,
  buildCompactionModelNotice,
  describeRemovedToolItem,
  diffRemovedSpans,
} from '../../../evidence/inventory'
import { withSystemTags } from '../../../util/messages'
import { countTokensMessagesCached } from '../../../util/token-counter'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'

// FID-2026-0819-005 Loop 297: post-compaction outcome application extracted
// from spawn-agent-inline.ts. The body is the verbatim context-pruner block
// that previously ran inline after the history replacement; the only changes
// are mechanical: previousHistory/previousHistoryLength/previousTokenEstimate
// and the caller-computed summary excerpt arrive as parameters, and
// params.fileContext?.projectRoot became a projectRoot parameter.

/**
 * Apply the context-pruner's compaction outcome to the parent agent state at
 * the history-replacement boundary: grounding refresh, terminal-phase
 * emission, inventory row, model notice, summary report, and the
 * compaction_summary wire event. Mutates parentAgentState in place.
 */
export function applyPrunerCompactionOutcome({
  parentAgentState,
  previousHistory,
  previousHistoryLength,
  previousTokenEstimate,
  summaryExcerpt,
  spawnParams,
  projectRoot,
  writeToClient,
}: {
  parentAgentState: AgentState
  previousHistory: AgentState['messageHistory']
  previousHistoryLength: number
  previousTokenEstimate: number
  summaryExcerpt: string
  spawnParams: unknown
  projectRoot: string
  writeToClient: (chunk: string | PrintModeEvent) => void
}): void {
  {
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
      projectRoot,
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
    // FID-2026-0828-001: the transcript event below carries the SAME excerpt
    // (single source of truth, Law 13). The excerpt arrives precomputed by
    // the caller (streamed buffer fallback, else the compacted history's
    // conversation_summary memory message).
    const prunerSummaryExcerpt = summaryExcerpt
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
}
