import { castDraft } from 'immer'

import { generateSessionId, initialState } from './initial-state'

import type {
  ChatSidebarActions,
  ChatStoreSet,
  CompactionLifecycleEvent,
} from './types'
import type { CompactionStatus } from '@savant-code/common/types/session-state'

type SetState = ChatStoreSet

/**
 * FID-2026-0814-006: shared bounded-history helper for the compaction counter
 * + transcript events. Keeps one record per run and caps the display list.
 */
function recordRun(
  state: {
    compactionCount: number
    compactionEvents: CompactionLifecycleEvent[]
  },
  event: Omit<CompactionLifecycleEvent, 'at'> & { at?: number },
): void {
  state.compactionCount += 1
  state.compactionEvents.push({ at: Date.now(), ...event })
  if (state.compactionEvents.length > 5) {
    state.compactionEvents = state.compactionEvents.slice(-5)
  }
}

/**
 * FID-2026-0815-008 (F-11): shallow field compare for the compaction status.
 * The runtime rebuilds a fresh object per heartbeat (not reference-stable), so
 * reference equality would never no-op; comparing the three scalar fields
 * collapses equal re-deliveries into true change-only notifications.
 */
function sameCompactionStatus(
  a: CompactionStatus | null,
  b: CompactionStatus | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.phase === b.phase &&
    a.percentUsed === b.percentUsed &&
    a.tokensSaved === b.tokensSaved
  )
}

/**
 * Sidebar data + FSM/activity/stream-lifecycle actions for the zustand store.
 * Extracted from chat-store.ts (FID-2026-0805-003); the immer-wrapped `set`
 * is injected so the action bodies stay verbatim.
 */
export const createSidebarActions = (set: SetState): ChatSidebarActions => ({
  // Sidebar data actions
  updateContextTokens: (used) =>
    set((state) => {
      // FID-2026-0815-008 (F-11): no-op on an equal value so the 2s heartbeat
      // and ~5s snapshot writes don't allocate a new state + notify subscribers.
      if (Object.is(state.contextTokensUsed, used)) return
      state.contextTokensUsed = used
    }),

  updateContextTokensMax: (max) =>
    set((state) => {
      if (Object.is(state.contextTokensMax, max)) return
      state.contextTokensMax = max
    }),

  setCompactionStatus: (status) =>
    set((state) => {
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
      } else if (prev?.phase === 'compacting' && status.phase === 'warning') {
        recordRun(state, {
          outcome: 'ineffective',
          percentUsed: status.percentUsed,
        })
      }
    }),

  recordCompactionRun: (event) =>
    set((state) => {
      recordRun(state, event)
    }),

  clearCompactionEvents: () =>
    set((state) => {
      state.compactionEvents = []
    }),

  addToolUsed: (toolName) =>
    set((state) => {
      if (!state.toolsUsed.includes(toolName)) {
        state.toolsUsed.push(toolName)
      }
    }),

  addToolHistory: (toolName) =>
    set((state) => {
      state.toolHistory.push({ name: toolName, timestamp: Date.now() })
      // Keep only last 5 entries
      if (state.toolHistory.length > 5) {
        state.toolHistory = state.toolHistory.slice(-5)
      }
    }),

  incrementFilesChanged: (type) =>
    set((state) => {
      if (type === 'modified') state.filesChanged.modified++
      else if (type === 'created') state.filesChanged.created++
      else if (type === 'added') state.filesChanged.added++
      else if (type === 'deleted') state.filesChanged.deleted++
    }),

  updateAgentStack: (stack) =>
    set((state) => {
      state.agentStack = stack
    }),

  updateSessionCost: (cost) =>
    set((state) => {
      if (Object.is(state.sessionCost, cost)) return
      state.sessionCost = cost
    }),

  resetSidebarData: () =>
    set((state) => {
      state.contextTokensUsed = 0
      // FID-2026-0813-023: reset the cap too. The old behavior kept the
      // previous model's window, so a model switch mid-session showed a stale
      // (often too-large) budget until the next run's startRunMonitors set it.
      // 0 means "unknown"; the sidebar falls back to the plain token readout.
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
    }),

  setFsmPhase: (phase) =>
    set((state) => {
      state.fsmPhase = phase
    }),

  setActivity: (activity) =>
    set((state) => {
      state.activity = activity
    }),

  addProvenanceEvent: (event) =>
    set((state) => {
      state.provenanceEvents.push(event)
      // FID-2026-0813-009: bounded display history, matching the runtime
      // provenance event cap so long sessions cannot grow the UI forever.
      if (state.provenanceEvents.length > 200) {
        state.provenanceEvents = state.provenanceEvents.slice(-200)
      }
    }),

  setTeacherState: (teacherState) =>
    set((state) => {
      // castDraft maps the runtime's `readonly` event array onto the immer
      // draft type; the snapshot is treated as fresh data, never mutated.
      state.teacherState = castDraft(teacherState)
    }),

  clearTeacher: () =>
    set((state) => {
      state.teacherState = null
    }),

  onNewUserMessage: () =>
    set((state) => {
      // Reset FSM phase + activity when the user sends a new message.
      // Unlike onStreamEnded (which guards against isRetrying / anti-thrash),
      // this is the canonical pre-run-zeroing path so it's always safe to
      // fire — even when the run that just ended was mid-retry.
      state.fsmPhase = 'idle'
      state.activity = { kind: 'idle', since: Date.now() }
      state.lastResetAt = Date.now()
    }),

  /**
   * FID-2026-0718-010 (F2): single canonical end-of-stream reset. Called from
   * finally block, abort handler, slash-command bridges, and stalled detector.
   * Idempotent — multiple gates can fire within the 100ms anti-thrash window.
   */
  onStreamEnded: (reason: string) =>
    set((state) => {
      // Guard 1: skip reset during retry (Q15) — retry path will signal
      // its own reset when it terminates.
      if (state.isRetrying) return
      // Guard 2: anti-thrash window (Q17) — first caller within 100ms wins.
      if (Date.now() - state.lastResetAt < 100) return

      state.fsmPhase = 'idle'
      state.activity = { kind: 'idle', since: Date.now() }
      state.streamingAgents = new Set<string>()
      state.activeSubagents = new Set<string>()
      state.isChainInProgress = false
      state.lastResetAt = Date.now()
      // Bump the chunk-seen watermark so the stalled detector sees
      // "freshly reset" and won't immediately retrigger.
      state._lastChunkAtMs = Date.now()
      // The reason parameter is intentionally not stored. Logging handled
      // by finish-logic.resetUiToIdle. Tracing via dev/LEARNINGS.
      void reason
    }),

  /**
   * FID-2026-0718-010 (F3/D5): stamp the last chunk timestamp. Called via
   * markChunkSeen() from finish-logic on every SDK chunk handler.
   * O(1) write.
   */
  markChunkSeen: () =>
    set((state) => {
      state._lastChunkAtMs = Date.now()
    }),

  setDevMode: (active) =>
    set((state) => {
      state.devMode = active
    }),

  setPermissionMode: (mode) =>
    set((state) => {
      state.permissionMode = mode
    }),

  reset: () =>
    set((state) => {
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
    }),
})
