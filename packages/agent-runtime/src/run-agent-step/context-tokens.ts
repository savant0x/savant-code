import { shouldUseLocalTokenCount } from '@savant-code/common/constants/free-agents'

import {
  DEFAULT_TAIL_BUDGET_TOKENS,
  foldFileOperations,
  planCompactionCut,
} from './compaction-plan'
import {
  resolveCompactionStatus,
  runMicroCompactPass,
} from './context-tokens-compaction'
import { reconcileTokenCount } from './reconcile-token-count'
import { getAgentPrompt } from '../templates/strings'
import {
  countTokens,
  countTokensJsonCached,
  countTokensMessagesCached,
} from '../util/token-counter'

import type { ContextCompactor } from '../context-compactor'
import type { LoopAgentStepsParams } from './types'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeCompactionStatus } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { CustomToolDefinitions } from '@savant-code/common/util/file'

const lastEmittedCompactionStatus = new WeakMap<AgentState, string>()

function emitCompactionStatus(
  agentState: AgentState,
  contextCompactor: ContextCompactor,
  onResponseChunk: (chunk: string | PrintModeCompactionStatus) => void,
): void {
  const status = agentState.compactionStatus
  if (!status) return
  // FID-2026-0901-006 P4: piggyback absolute token counts so the desktop
  // context meter can render a true window tracker ("84k / 200k") rather
  // than deriving one from the rounded percent. The window denominator is
  // reactiveCompact (FID-2026-0814-001 single source of truth).
  const contextTokens = agentState.contextTokenCount
  const windowTokens = contextCompactor.getThresholds().reactiveCompact
  const key = JSON.stringify({ ...status, contextTokens, windowTokens })
  if (lastEmittedCompactionStatus.get(agentState) === key) return
  lastEmittedCompactionStatus.set(agentState, key)
  onResponseChunk({
    type: 'compaction_status',
    ...status,
    ...(contextTokens !== undefined ? { contextTokens: contextTokens } : {}),
    ...(windowTokens !== undefined ? { windowTokens: windowTokens } : {}),
  })
}

/**
 * Computes the step prompt once per step and updates the agent state's
 * context token count, then runs the zero-cost micro-compact and logs the
 * auto-compact threshold check. Behavior identical to the inline loop block.
 *
 * FID-2026-0929-005 (gut the backend): local estimation is the only token
 * accounting. The SavantCode web-API count endpoint (a credit-billing
 * surface for hosted paid runs) is deleted with the backend; the
 * hasSavantCodeBackend branch, the eager message-array build it guarded, and
 * the endpoint stamping all go with it.
 */
export async function prepareStepContext(params: {
  loopParams: LoopAgentStepsParams
  agentTemplate: AgentTemplate
  agentState: AgentState
  system: string
  toolsForTokenCount: Array<{
    name: string
    description?: string
    input_schema?: JSONValue
  }>
  contextCompactor: ContextCompactor
  logger: Logger
  additionalToolDefinitionsWithCache: () => Promise<CustomToolDefinitions>
}): Promise<{ stepPrompt: string | undefined; systemTokens: number }> {
  const {
    loopParams,
    agentTemplate,
    agentState,
    system,
    toolsForTokenCount,
    contextCompactor,
    logger,
    additionalToolDefinitionsWithCache,
  } = params

  // FID-2026-0802-005 L15: computed once per step and reused by
  // runAgentStep. Note: this runs before the programmatic step, so a
  // handleSteps generator that mutates history (e.g. set_messages) could
  // in theory make the USER_INPUT_PROMPT placeholder stale — no bundled
  // agent does this; acceptable per the FID.
  const stepPrompt = await getAgentPrompt({
    ...loopParams,
    agentTemplate,
    promptType: { type: 'stepPrompt' },
    fileContext: loopParams.fileContext,
    agentState,
    agentTemplates: loopParams.localAgentTemplates,
    logger,
    additionalToolDefinitions: additionalToolDefinitionsWithCache,
  })
  // FID-2026-0815-011 E-01: the system prompt is session-invariant, so its
  // token count is computed once here and reused by runAgentStep (which
  // otherwise tokenizes it again every step).
  const systemTokens = countTokens(system)

  // Count structured message content (not JSON.stringify, which inflates the
  // count and counts image base64 as text); system is a plain string; tool
  // schemas stay JSON since that's roughly how the model sees them.
  // FID-2026-0802-005 H2: countTokensMessagesCached memoizes per-message
  // counts by object identity, so the history is tokenized once over the
  // whole run instead of re-encoded every step (O(n²) → O(n)).
  //
  // FID-2026-0929-005: `shouldUseLocalTokenCount` survives as the free-tier
  // gate it was, but every run is now external — there is no hosted paid
  // lane — so the estimator always wins.
  void shouldUseLocalTokenCount
  agentState.contextTokenCount =
    countTokensMessagesCached(agentState.messageHistory) +
    countTokens(stepPrompt ?? '') +
    systemTokens +
    countTokensJsonCached(toolsForTokenCount)

  // FID-2026-0821-001 P2-1: single precedence owner — fresh provider usage
  // overrides the estimator; stale usage (post-prune) loses to the fresher
  // lastPrunerCompletionAt stamp, so the spawn-boundary recount stands.
  // Provider usage still arrives via the stream's onUsage channel (real
  // provider responses), so both sources converge through this entry point.
  // FID-2026-0821-003-A: pass the step logger so each reconcile decision is
  // visible (chosen source + inputs) — the observability channel for the
  // estimator↔truth alternation.
  agentState.contextTokenCount = reconcileTokenCount({
    agentState,
    localEstimate: agentState.contextTokenCount,
    logger,
  })

  // P3b (FID-2026-0806-003): score any compaction that ran during the
  // PREVIOUS step against the real post-response token count just computed
  // above. Must run BEFORE the fresh shouldAutoCompact preflight below so
  // the preflight arms a new score instead of re-judging the old one. No-op
  // when nothing was armed (Hermes anti-thrash guard).
  contextCompactor.scoreCompactionEffectiveness(agentState.contextTokenCount)

  // FID-2026-0819-005 Loop 253: the micro-compact pass and the compaction
  // status resolution are extracted verbatim to context-tokens-compaction.ts.
  const thresholds = contextCompactor.getThresholds()
  const microResult = runMicroCompactPass({
    agentState,
    contextCompactor,
    loopParams,
    logger,
    thresholds,
  })
  const autoCompactCheck = contextCompactor.shouldAutoCompact(
    agentState.messageHistory,
    agentState.contextTokenCount,
  )
  resolveCompactionStatus({
    agentState,
    contextCompactor,
    logger,
    thresholds,
    autoCompactCheck,
    microResult,
  })

  // FID-2026-1006-003 WP1/WP2: refresh the two compaction inputs the
  // serialized context pruner consumes as DATA. The plan makes the cut legal
  // (never at a tool result) and re-summarizes only from the previous kept
  // boundary; the ledger accumulates every window's file operations so a path
  // touched many compactions ago is still tracked. Both travel to the pruner
  // as spawn params (see agents/savant/handle-steps-template-body-b.ts).
  agentState.compactionCutPlan = planCompactionCut({
    messages: agentState.messageHistory,
    tailBudgetTokens:
      loopParams.compression?.keepRecentTokens ?? DEFAULT_TAIL_BUDGET_TOKENS,
  })
  const ledgerUpdate = foldFileOperations({
    ledger: agentState.compactionFileLedger,
    messages: agentState.messageHistory,
    watermark: agentState.compactionFileLedgerWatermark ?? 0,
  })
  agentState.compactionFileLedger = ledgerUpdate.ledger
  agentState.compactionFileLedgerWatermark = ledgerUpdate.watermark

  emitCompactionStatus(agentState, contextCompactor, loopParams.onResponseChunk)
  return { stepPrompt, systemTokens }
}
