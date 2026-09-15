/**
 * FID-2026-0915-002 — the context-pruner guard blocks, moved verbatim from
 * spawn-agent-inline.ts (split 11, sibling-extraction precedent:
 * -summary.ts, -pruner-outcome.ts, -verdict.ts):
 *
 * 1. resolvePrunerSpawnParams — the FID-2026-0824-024/-0914-002 injection of
 *    harness-controlled digest caps + project root into the pruner's spawn
 *    params (after validation, bypassing template schema strictness).
 * 2. markPrunerBlockedOnCrash — the FID-2026-0822-001 RC4 terminal-state
 *    emission when an inline pruner crashes (compactionStatus must not stay
 *    'compacting' forever).
 * 3. applyPrunerPostRunGuards — the post-run excerpt → LLM semantic upgrade
 *    (FID-2026-0914-002) → compaction-outcome application.
 */
import { applySemanticSummaryUpgrade } from './semantic-summary-upgrade'
import { applyPrunerCompactionOutcome } from './spawn-agent-inline-pruner-outcome'
import {
  PRUNER_SUMMARY_EXCERPT_CHARS,
  extractPrunerSummaryFromHistory,
} from './spawn-agent-inline-summary'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'

/** The LLM upgrade call's params, typed by the upgrade function itself. */
type SemanticUpgradeParams = Parameters<typeof applySemanticSummaryUpgrade>[0]

/**
 * Inject operator/harness-configured digest caps and the repo root into the
 * context-pruner's spawn params AFTER validation — harness-controlled
 * numbers bypass template schema strictness while model-provided params
 * stay guarded. Non-pruner agents get their spawn params unchanged.
 */
export function resolvePrunerSpawnParams(opts: {
  agentType: string
  digestCaps: AgentState['digestCaps']
  projectRoot: string | undefined
  spawnParams: Record<string, JSONValue> | undefined
}): Record<string, JSONValue> | undefined {
  const { agentType, digestCaps, projectRoot, spawnParams } = opts
  return agentType === 'context-pruner' && (digestCaps || projectRoot)
    ? {
        ...(spawnParams ?? {}),
        ...(digestCaps?.headChars !== undefined
          ? { digestHeadChars: digestCaps.headChars }
          : {}),
        ...(digestCaps?.tailChars !== undefined
          ? { digestTailChars: digestCaps.tailChars }
          : {}),
        ...(projectRoot ? { projectRoot } : {}),
      }
    : spawnParams
}

/**
 * A crashed inline context-pruner used to leave compactionStatus stuck at
 * 'compacting' forever — the terminal-phase emission runs only on success.
 * Emit the truthful blocked state and stamp the attempt BEFORE the error
 * propagates, so the CLI panel and the anti-thrash cooldown see terminal
 * reality instead of eternal silence.
 */
export function markPrunerBlockedOnCrash(opts: {
  agentType: string
  parentAgentState: AgentState
}): void {
  const { agentType, parentAgentState } = opts
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
}

/**
 * Post-run pruner guards: extract the streamed excerpt (falling back to the
 * history scan), upgrade it into an LLM-written semantic handoff (session
 * model, kimi pattern; writer failure degrades to the deterministic excerpt
 * verbatim inside the upgrade), then apply the compaction outcome at the
 * parent mutation boundary. No-op unless the child was a root context-pruner.
 */
export async function applyPrunerPostRunGuards(opts: {
  agentType: string
  parentAgentState: AgentState
  parentAgentTemplate: AgentTemplate
  resultAgentState: AgentState
  prunerSummaryBuffer: string
  previousHistory: AgentState['messageHistory']
  previousHistoryLength: number
  previousTokenEstimate: number
  spawnParams: Record<string, JSONValue> | undefined
  projectRoot: string
  upgrade: Omit<SemanticUpgradeParams, 'deterministicExcerpt'>
  writeToClient: (chunk: string | PrintModeEvent) => void
}): Promise<void> {
  const { agentType, parentAgentState } = opts
  const streamedExcerpt = opts.prunerSummaryBuffer.slice(
    -PRUNER_SUMMARY_EXCERPT_CHARS,
  )
  let prunerSummaryExcerpt =
    streamedExcerpt.trim().length > 0
      ? streamedExcerpt
      : extractPrunerSummaryFromHistory(opts.resultAgentState.messageHistory)

  // FID-2026-0914-002: upgrade the deterministic excerpt into an LLM-written
  // semantic handoff (kimi pattern) BEFORE it is surfaced. The session model
  // writes the summary (operator ruling MQ1: main model only — no override
  // knob); any writer failure degrades to the deterministic excerpt
  // verbatim inside the upgrade, and user aborts propagate. The parent run
  // waits one bounded model call here — this replaces the pre-fix behavior
  // of surfacing a fragment-storm transcription.
  if (
    agentType === 'context-pruner' &&
    !parentAgentState.parentId &&
    prunerSummaryExcerpt.trim().length > 0
  ) {
    const upgrade = await applySemanticSummaryUpgrade({
      ...opts.upgrade,
      deterministicExcerpt: prunerSummaryExcerpt,
    })
    prunerSummaryExcerpt = upgrade.excerpt
  }

  if (agentType === 'context-pruner' && !parentAgentState.parentId) {
    applyPrunerCompactionOutcome({
      parentAgentState,
      previousHistory: opts.previousHistory,
      previousHistoryLength: opts.previousHistoryLength,
      previousTokenEstimate: opts.previousTokenEstimate,
      summaryExcerpt: prunerSummaryExcerpt,
      spawnParams: opts.spawnParams,
      projectRoot: opts.projectRoot,
      writeToClient: opts.writeToClient,
    })
  }
}
