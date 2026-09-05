// FID-2026-0819-005 Loop 235: the sidebar reset halves + compaction-status
// FSM, extracted verbatim from sidebar-actions.ts (over the 300-line
// ceiling). Loop 147's extraction note and all FID comments preserved.

import { castDraft } from 'immer'

import { recordRun, sameCompactionStatus } from './compaction-helpers'
import { generateSessionId, initialState } from './initial-state'

import type { ChatStore } from './types'
import type { Draft } from 'immer'

/** The immer draft type the middleware hands to action bodies. */
type DraftState = Draft<ChatStore>

/**
 * Compaction-status transition FSM (FID-2026-0815-008 (F-11) dedupe,
 * FID-2026-0814-006 lifecycle derivation, FID-2026-0821-001 P0-2/P1-3
 * runtime-truth, FID-2026-0824-023 micro-compact visibility).
 */
export function applyCompactionStatus(
  state: DraftState,
  status: ChatStore['compactionStatus'],
): void {
  // FID-2026-0815-008 (F-11): no-op on an equivalent status so re-delivered
  // heartbeats don't produce a new state. Shallow compare (not reference)
  // because the runtime rebuilds a fresh object per heartbeat.
  if (sameCompactionStatus(state.compactionStatus, status)) return
  const prev = state.compactionStatus
  state.compactionStatus = status
  if (!status) return
  // FID-2026-0814-006: derive terminal lifecycle events from the runtime
  // transition, so the counter + transcript stay honest without a new
  // runtime channel. The runtime writes `compacting` at pruner spawn and
  // `pruned`/`warning` at completion (spawn-agent-inline.ts); a `warning`
  // that follows `compacting` is the pruner-ineffective outcome, while a
  // bare `warning` is the step-boundary threshold state (no run).
  if (prev?.phase === 'compacting' && status.phase === 'pruned') {
    recordRun(state, {
      outcome: 'pruned',
      tokensSaved: status.tokensSaved,
      percentUsed: status.percentUsed,
    })
  } else if (status.phase === 'ineffective') {
    // FID-2026-0821-001 P0-2/P1-3: trust the runtime-emitted terminal
    // phase directly (runtime speaks truth) — no transition inference.
    recordRun(state, {
      outcome: 'ineffective',
      percentUsed: status.percentUsed,
    })
  } else if (prev?.phase === 'compacting' && status.phase === 'warning') {
    // Back-compat fallback for older paired binaries whose runtime still
    // writes `warning` at an ineffective pruner completion.
    recordRun(state, {
      outcome: 'ineffective',
      percentUsed: status.percentUsed,
    })
  } else if (status.phase === 'compacted') {
    // FID-2026-0824-023: Layer-2 micro-compact outcomes become visible
    // lifecycle events — stale tool results were cleared and the operator
    // sees it (data destruction is never silent).
    recordRun(state, {
      outcome: 'compacted',
      tokensSaved: status.tokensSaved,
      percentUsed: status.percentUsed,
    })
  }
}

/** Session/id/input half of `reset` (verbatim). */
export function resetChatSessionState(state: DraftState): void {
  state.chatSessionId = generateSessionId()
  state.messages = initialState.messages.slice()
  state.streamingAgents = new Set(initialState.streamingAgents)
  state.focusedAgentId = initialState.focusedAgentId
  state.inputValue = initialState.inputValue
  state.cursorPosition = initialState.cursorPosition
  state.lastEditDueToNav = initialState.lastEditDueToNav
  // Terminal capabilities and focus outlive a chat. Resetting these can
  // re-enable animation while the app is still unfocused, and focus
  // support would stay false because the mounted detector only reports
  // support once per subscription.
  state.activeSubagents = new Set(initialState.activeSubagents)
  state.isChainInProgress = initialState.isChainInProgress
  state.slashSelectedIndex = initialState.slashSelectedIndex
  state.agentSelectedIndex = initialState.agentSelectedIndex
  state.agentMode = initialState.agentMode
  state.hasReceivedPlanResponse = initialState.hasReceivedPlanResponse
  state.lastMessageMode = initialState.lastMessageMode
  state.sessionCreditsUsed = initialState.sessionCreditsUsed
  state.runState = initialState.runState
    ? castDraft(initialState.runState)
    : null
  state.activeTopBanner = initialState.activeTopBanner
  state.inputMode = initialState.inputMode
  state.adsEnabled = initialState.adsEnabled
  state.isRetrying = initialState.isRetrying
  state.askUserState = initialState.askUserState
  state.pendingAttachments = []
  state.pendingBashMessages = []
  state.suggestedFollowups = null
  state.clickedFollowupsMap = new Map<string, Set<number>>()
}

/** Sidebar half of `reset` (verbatim; FID-2026-0813-023 / -0814-006
 *  comments preserved). */
export function resetSidebarSlice(state: DraftState): void {
  // Reset sidebar data. FID-2026-0813-023: reset the cap as well — a
  // stale previous-model window misled the context meter; 0 = unknown.
  state.contextTokensUsed = 0
  state.contextTokensMax = 0
  state.compactionStatus = null
  // FID-2026-0814-006: the counter + transcript history are per-session
  // activity — reset alongside provenanceEvents on every session reset.
  state.compactionCount = 0
  state.compactionEvents = []
  state.toolsUsed = []
  state.toolHistory = []
  state.filesChanged = { modified: 0, created: 0, added: 0, deleted: 0 }
  state.agentStack = []
  state.sessionCost = 0
  state.fsmPhase = initialState.fsmPhase
  state.activity = initialState.activity
  state.provenanceEvents = []
  state.teacherState = null
  state.devMode = initialState.devMode
  state.permissionMode = initialState.permissionMode
  // FID-2026-0818-002: a new chat drops any in-flight drive run.
  state.driveMode = initialState.driveMode
  state.driveState = initialState.driveState
  state.activeAutoRunId = initialState.activeAutoRunId
  state.drivePlanDraft = initialState.drivePlanDraft
  state.drivePaused = initialState.drivePaused
}
