import type {
  CompactionLifecycleEvent,
  AgentStackEntry,
} from './chat-store-common-types'
import type { TeacherSessionState } from '../../teacher/runtime'
import type { ChatMessage } from '../../types/chat'
import type {
  InputValue,
  AskUserState,
  TopBannerType,
  PendingAttachment,
  PendingImageAttachment,
  PendingTextAttachment,
  PendingFileAttachment,
  PendingBashMessage,
  SuggestedFollowupsState,
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
  setLastCompactionReport: (
    report: {
      summaryExcerpt: string
      removedMessages: number
      tokensSaved?: number
      percentUsed?: number
    } | null,
  ) => void
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
  /** FID-2026-0818-002: set the drive-mode lock flag. */
  setDriveMode: (active: boolean) => void
  /** FID-2026-0818-002: set the Auto Drive lifecycle state. */
  setDriveState: (state: DriveModeState) => void
  /** FID-2026-0818-002: set the active `/auto` run id. */
  setActiveAutoRunId: (id: string | null) => void
  /** FID-2026-0818-002: set the plan draft under confirmation. */
  setDrivePlanDraft: (draft: string | null) => void
  /** FID-2026-0818-007: set the Esc pause latch. */
  setDrivePaused: (paused: boolean) => void
}

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
  | 'setLastCompactionReport'
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
