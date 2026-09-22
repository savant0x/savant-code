import { fireCompactionHook } from '../../../hooks/lifecycle-hooks'

import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0919-031 — `PreCompact` at the compaction ATTEMPT, the half of the
 * attempt/effect pair that the pruner spawn owns.
 *
 * The harness decides compaction is due and spawns the context-pruner: that is
 * the attempt. A `Pre` event cannot know the effect, so it reports the trigger's
 * facts — the token count the decision was made on — and the EFFECT is
 * `PostCompact`'s job, fired by `applyPrunerCompactionOutcome` only when the
 * compaction actually compacted (`messagesRemoved > 0 && tokensSaved > 0`). An
 * ineffective attempt therefore emits a `PreCompact` with no matching
 * `PostCompact`, and that unmatched pair IS the signal (see
 * `hooks/lifecycle-hooks.ts` for the ruling).
 *
 * Extracted from `spawn-agent-inline.ts` so the attempt-side event lives beside
 * its effect-side twin (`spawn-agent-inline-pruner-outcome.ts`) and the handler
 * stays inside the 300-line budget the quality gate enforces.
 *
 * A no-op for every inline agent that is not the pruner: this is called for all
 * of them, and only the pruner spawn is a compaction attempt.
 */
export function fireCompactionAttemptForInlineSpawn(params: {
  agentType: string
  parentAgentState: AgentState
  projectRoot: string | undefined
}): void {
  const { agentType, parentAgentState, projectRoot } = params
  if (agentType !== 'context-pruner') return

  const contextTokenCount = parentAgentState.contextTokenCount
  const maxContextLength = parentAgentState.maxContextLength ?? 200_000
  fireCompactionHook({
    event: 'PreCompact',
    parentAgentState,
    projectRoot,
    toolResult: {
      trigger: 'pruner-spawn',
      contextTokenCount,
      percentUsed: Math.round((contextTokenCount / maxContextLength) * 100),
    },
  })
}
