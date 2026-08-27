import type { ChatStoreActions } from './chat-store-actions'
import type {
  CompactionLifecycleEvent,
  LastCompactionReport,
  ToolHistoryEntry,
  FilesChanged,
  AgentStackEntry,
} from './chat-store-common-types'
import type { TeacherSessionState } from '../../teacher/runtime'
import type { ChatMessage } from '../../types/chat'
import type {
  TopBannerType,
  InputValue,
  AskUserQuestion,
  AnswerState,
  AskUserState,
  PendingImageStatus,
  PendingImageAttachment,
  PendingTextAttachment,
  PendingFileAttachment,
  PendingAttachment,
  PendingImage,
  PendingBashMessage,
  SuggestedFollowup,
  SuggestedFollowupsState,
  ClickedFollowupsMap,
} from '../../types/store'
import type { AgentMode } from '../../utils/constants'
import type { InputMode } from '../../utils/input-modes'
import type { PrintModeProvenanceReceipt } from '@savant-code/common/types/print-mode'
import type {
  AgentActivity,
  CompactionStatus,
  DriveModeState,
} from '@savant-code/common/types/session-state'
import type { RunState } from '@savant-code/sdk'
import type { StateCreator } from 'zustand'

// Re-export types from the types/store module to maintain backwards compatibility
export type {
  TopBannerType,
  InputValue,
  AskUserQuestion,
  AnswerState,
  AskUserState,
  PendingImageStatus,
  PendingImageAttachment,
  PendingTextAttachment,
  PendingFileAttachment,
  PendingAttachment,
  PendingImage,
  PendingBashMessage,
  SuggestedFollowup,
  SuggestedFollowupsState,
  ClickedFollowupsMap,
}

export type {
  CompactionLifecycleEvent,
  ToolHistoryEntry,
  FilesChanged,
  AgentStackEntry,
} from './chat-store-common-types'

export type ChatStoreState = {
  /** Unique ID for this chat session, regenerated on /new */
  chatSessionId: string
  messages: ChatMessage[]
  streamingAgents: Set<string>
  focusedAgentId: string | null
  inputValue: string
  cursorPosition: number
  lastEditDueToNav: boolean
  inputFocused: boolean
  isFocusSupported: boolean
  activeSubagents: Set<string>
  isChainInProgress: boolean
  slashSelectedIndex: number
  agentSelectedIndex: number
  agentMode: AgentMode
  hasReceivedPlanResponse: boolean
  lastMessageMode: AgentMode | null
  sessionCreditsUsed: number
  runState: RunState | null
  /** The currently active top banner, or null if none */
  activeTopBanner: TopBannerType
  inputMode: InputMode
  /** Reactive ads state (FID-007 P1): seeded from settings, updated by the
   *  ads commands so slash-command filtering can depend on it reactively
   *  instead of polling a non-reactive module read per keystroke. */
  adsEnabled: boolean
  isRetrying: boolean
  askUserState: AskUserState
  pendingAttachments: PendingAttachment[]
  pendingBashMessages: PendingBashMessage[]
  suggestedFollowups: SuggestedFollowupsState | null
  /** Persisted clicked indices per toolCallId */
  clickedFollowupsMap: ClickedFollowupsMap

  // Sidebar data
  contextTokensUsed: number
  contextTokensMax: number
  /**
   * Manual sidebar fold (FID-2026-0816-010 follow-up): when true the sidebar
   * collapses to the icon rail at ANY terminal width (Ctrl+B / edge handle),
   * independent of the automatic <60-col narrow collapse. UI preference —
   * deliberately NOT reset on session reset.
   */
  sidebarCollapsed: boolean
  /** FID-2026-0813-023: live compaction status for the read-only sidebar row. */
  compactionStatus: CompactionStatus | null
  /**
   * FID-2026-0814-006: session compaction counter + bounded lifecycle events
   * (OpenClaw "/status 🧹 Compactions: N" + kimi transcript-block patterns).
   * Incremented on each `pruned` outcome; the bounded event list drives the
   * in-stream transcript signal. Reset per session like `provenanceEvents`.
   */
  compactionCount: number
  compactionEvents: CompactionLifecycleEvent[]
  /** FID-2026-0824-023 stream-routing: last pruner report (WHAT was compacted). */
  lastCompactionReport: LastCompactionReport | null
  toolsUsed: string[]
  toolHistory: ToolHistoryEntry[]
  filesChanged: FilesChanged
  agentStack: AgentStackEntry[]
  sessionCost: number
  fsmPhase: string
  /** Dev override — bypasses all ECHO tool gating when true. */
  devMode: boolean
  /** Sandbox permission mode: safe = deny risky, prompt = ask when possible, unsafe = allow. */
  permissionMode: 'safe' | 'prompt' | 'unsafe'
  /**
   * Runtime activity indicator (FID-2026-0718-009). Distinct from fsmPhase.
   * What the agent is doing RIGHT NOW (tool/model/sub-agent/research).
   */
  activity: AgentActivity
  /** FID-2026-0813-009: bounded signed provenance events for the read-only
   *  trust matrix. Never used as a tool-control channel. */
  provenanceEvents: PrintModeProvenanceReceipt[]
  /** FID-2026-0813-022: live teacher exercise state for the read-only sidebar
   *  surface. Passive mirror of the runtime singleton; never a control path. */
  teacherState: TeacherSessionState | null
  /**
   * FID-2026-0718-010 (Q17): anti-thrash window stamp. Tracks when
   * onStreamEnded last fired. Resets within 100ms are no-ops to dedupe
   * overlapping resets (finish/abort/slash fired in the same tick).
   */
  lastResetAt: number
  /**
   * FID-2026-0718-010 (D5/Q19): watermark updated by finish-logic.markChunkSeen
   * on every SDK chunk. StalledResetWatcher reads this to detect 30s+
   * silence and auto-reset to idle.
   */
  _lastChunkAtMs: number
  /**
   * FID-2026-0818-002: Auto Drive. `driveMode` true = the operator confirmed
   * the plan; interactive tools are stripped and ordinary input is locked.
   */
  driveMode: boolean
  /** FID-2026-0818-002: Auto Drive lifecycle state. */
  driveState: DriveModeState
  /** FID-2026-0818-002: id of the active `/auto` run, or null. */
  activeAutoRunId: string | null
  /**
   * FID-2026-0818-002: the pre-build plan draft presented for operator
   * confirmation (editable before approval).
   */
  drivePlanDraft: string | null
  /**
   * FID-2026-0818-007: the operator's Esc pause latch. True after a first Esc
   * (pause requested); a second Esc while latched escalates to stop. Cleared
   * by `/auto-drive resume`, `/auto-drive stop`, and drive completion/reset.
   */
  drivePaused: boolean
}

export type { ChatStoreActions } from './chat-store-actions'
export type {
  ChatCoreActions,
  ChatAliasActions,
  ChatSidebarActions,
} from './chat-store-actions'

export type ChatStore = ChatStoreState & ChatStoreActions

/**
 * The exact setState signature passed by the immer middleware to the store
 * creator (FID-2026-0805-003). Derived from zustand's StateCreator so the
 * draft-aware mutator typing stays in sync with the middleware.
 */
export type ChatStoreSet = Parameters<
  StateCreator<ChatStore, [['zustand/immer', never]], []>
>[0]
