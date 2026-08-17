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
} from '@savant-code/common/types/session-state'
import type { RunState } from '@savant-code/sdk'
import type { StateCreator } from 'zustand'

/**
 * FID-2026-0814-006: one terminal compaction lifecycle event for the bounded
 * in-stream transcript signal (kimi pattern). `pruned` = successful full
 * pruner run; `ineffective` = a pruner run that removed nothing (the runtime
 * writes phase `warning` at that boundary). Display-only; never a control
 * channel.
 */
export type CompactionLifecycleEvent = {
  outcome: 'pruned' | 'ineffective'
  tokensSaved?: number
  percentUsed?: number
  at: number
}

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

export type ToolHistoryEntry = {
  name: string
  timestamp: number
}

export type FilesChanged = {
  modified: number
  created: number
  added: number
  deleted: number
}

export type AgentStackEntry = {
  id: string
  displayName?: string
  isActive: boolean
}

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
}

export type ChatStoreActions = {
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  setStreamingAgents: (
    value: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => void
  setFocusedAgentId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  setInputFocused: (focused: boolean) => void
  setIsFocusSupported: (supported: boolean) => void
  setActiveSubagents: (
    value: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => void
  setIsChainInProgress: (active: boolean) => void
  setSlashSelectedIndex: (value: number | ((prev: number) => number)) => void
  setAgentSelectedIndex: (value: number | ((prev: number) => number)) => void
  setAgentMode: (mode: AgentMode) => void
  toggleAgentMode: () => void
  setHasReceivedPlanResponse: (value: boolean) => void
  setLastMessageMode: (mode: AgentMode | null) => void
  addSessionCredits: (credits: number) => void
  setRunState: (runState: RunState | null) => void
  setActiveTopBanner: (banner: TopBannerType) => void
  closeTopBanner: () => void
  setInputMode: (mode: InputMode) => void
  setAdsEnabled: (enabled: boolean) => void
  setIsRetrying: (retrying: boolean) => void
  setAskUserState: (state: AskUserState) => void
  updateAskUserAnswer: (questionIndex: number, optionIndex: number) => void
  updateAskUserOtherText: (questionIndex: number, text: string) => void
  addPendingAttachment: (attachment: PendingAttachment) => void
  removePendingAttachment: (id: string) => void
  clearPendingAttachments: () => void
  // Convenience aliases for backwards compatibility
  addPendingImage: (image: Omit<PendingImageAttachment, 'kind'>) => void
  removePendingImage: (path: string) => void
  clearPendingImages: () => void
  addPendingTextAttachment: (
    attachment: Omit<PendingTextAttachment, 'kind'>,
  ) => void
  removePendingTextAttachment: (id: string) => void
  clearPendingTextAttachments: () => void
  addPendingFileAttachment: (
    attachment: Omit<PendingFileAttachment, 'kind'>,
  ) => void
  addPendingBashMessage: (message: PendingBashMessage) => void
  updatePendingBashMessage: (
    id: string,
    updates: Partial<PendingBashMessage>,
  ) => void
  removePendingBashMessage: (id: string) => void
  clearPendingBashMessages: () => void
  setSuggestedFollowups: (state: SuggestedFollowupsState | null) => void
  markFollowupClicked: (toolCallId: string, index: number) => void
  reset: () => void

  // Sidebar data actions
  updateContextTokens: (used: number) => void
  updateContextTokensMax: (max: number) => void
  /** FID-2026-0813-023: set the live compaction status for the sidebar row. */
  setCompactionStatus: (status: CompactionStatus | null) => void
  /** FID-2026-0814-006: bump the session compaction counter (per pruned run). */
  recordCompactionRun: (event: CompactionLifecycleEvent) => void
  /** FID-2026-0814-006: clear the bounded compaction lifecycle events. */
  clearCompactionEvents: () => void
  addToolUsed: (toolName: string) => void
  addToolHistory: (toolName: string) => void
  incrementFilesChanged: (
    type: 'modified' | 'created' | 'added' | 'deleted',
  ) => void
  updateAgentStack: (stack: AgentStackEntry[]) => void
  updateSessionCost: (cost: number) => void
  resetSidebarData: () => void
  /**
   * FID-2026-0816-010 follow-up: manual sidebar fold — true collapses the
   * sidebar to the icon rail at any width (Ctrl+B / edge handle).
   */
  setSidebarCollapsed: (collapsed: boolean) => void
  /** Set the current ECHO FSM phase (wired from transition_phase tool results). */
  setFsmPhase: (phase: string) => void
  /** Set the runtime activity indicator (FID-2026-0718-009). */
  setActivity: (activity: AgentActivity) => void
  /** Append one bounded provenance event for the read-only trust matrix. */
  addProvenanceEvent: (event: PrintModeProvenanceReceipt) => void
  /** FID-2026-0813-022: replace the live teacher surface with a fresh snapshot. */
  setTeacherState: (state: TeacherSessionState) => void
  /** FID-2026-0813-022: clear the teacher surface (exercise exited). */
  clearTeacher: () => void
  /** Reset FSM phase to idle when a new user message is sent. */
  onNewUserMessage: () => void
  /**
   * FID-2026-0718-010 (F2): single canonical end-of-stream reset. Clears
   * fsmPhase, activity, streamingAgents, activeSubagents, isChainInProgress.
   * Idempotent; guarded by isRetrying + 100ms anti-thrash window (Q17).
   */
  onStreamEnded: (reason: string) => void
  /**
   * FID-2026-0718-010 (F3/D5): stamp the last chunk timestamp for the
   * stalled-reset watchdog. Called from finish-logic.markChunkSeen.
   */
  markChunkSeen: () => void
  /** Toggle dev override mode on/off. */
  setDevMode: (active: boolean) => void
  /** Set the sandbox permission mode. */
  setPermissionMode: (mode: 'safe' | 'prompt' | 'unsafe') => void
}

export type ChatStore = ChatStoreState & ChatStoreActions

/**
 * The exact setState signature passed by the immer middleware to the store
 * creator (FID-2026-0805-003). Derived from zustand's StateCreator so the
 * draft-aware mutator typing stays in sync with the middleware.
 */
export type ChatStoreSet = Parameters<
  StateCreator<ChatStore, [['zustand/immer', never]], []>
>[0]

/**
 * Action sub-groups mirroring the module split (FID-2026-0805-003).
 * ChatStoreActions is the full union; the factories in chat-actions.ts /
 * sidebar-actions.ts implement these slices and the thin store assembles
 * them via object spread.
 */
type AliasActionKeys =
  | 'addPendingImage'
  | 'removePendingImage'
  | 'clearPendingImages'
  | 'addPendingTextAttachment'
  | 'removePendingTextAttachment'
  | 'clearPendingTextAttachments'
  | 'addPendingFileAttachment'

type SidebarActionKeys =
  | 'updateContextTokens'
  | 'updateContextTokensMax'
  | 'setSidebarCollapsed'
  | 'setCompactionStatus'
  | 'recordCompactionRun'
  | 'clearCompactionEvents'
  | 'addToolUsed'
  | 'addToolHistory'
  | 'incrementFilesChanged'
  | 'updateAgentStack'
  | 'updateSessionCost'
  | 'resetSidebarData'
  | 'setFsmPhase'
  | 'setActivity'
  | 'addProvenanceEvent'
  | 'setTeacherState'
  | 'clearTeacher'
  | 'onNewUserMessage'
  | 'onStreamEnded'
  | 'markChunkSeen'
  | 'setDevMode'
  | 'setPermissionMode'
  | 'reset'

/** Core chat actions implemented by createChatActions. */
export type ChatCoreActions = Omit<
  ChatStoreActions,
  AliasActionKeys | SidebarActionKeys
>

/** Store-instance-bound convenience aliases defined in the thin store file. */
export type ChatAliasActions = Pick<ChatStoreActions, AliasActionKeys>

/** Sidebar/FSM/stream actions implemented by createSidebarActions. */
export type ChatSidebarActions = Pick<ChatStoreActions, SidebarActionKeys>
