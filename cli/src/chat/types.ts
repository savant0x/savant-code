import type { CommandResult } from '../commands/command-registry'
import type { MultilineInputHandle } from '../components/multiline-input'
import type { SuggestedPromptSelection } from '../components/suggested-prompts'
import type { SuggestionItem } from '../components/suggestion-menu'
import type { ChatScrollboxProps } from '../hooks/use-chat-ui'
import type { AdResponse } from '../hooks/use-gravity-ad'
import type {
  AgentStackEntry,
  FilesChanged,
  ToolHistoryEntry,
} from '../state/chat-store'
import type { RewindMode } from '../state/rewind-picker-store'
import type { ChatMessage } from '../types/chat'
import type { SavantFreeSession } from '../types/savant-free-session'
import type {
  AskUserState,
  InputValue,
  PendingBashMessage as PendingBashMessageType,
} from '../types/store'
import type { ChatTheme } from '../types/theme-system'
import type { User } from '../utils/auth'
import type { AgentMode } from '../utils/constants'
import type { OpenRouterModel } from '../utils/openrouter-models'
import type { ProviderSetupName } from '../utils/provider-setup'
import type { PermissionMode } from '../utils/settings'
import type {
  AuthStatus,
  StatusIndicatorState,
} from '../utils/status-indicator-state'
import type { BoxRenderable, ScrollBoxRenderable } from '@opentui/core'
import type { FileTreeNode } from '@savant-code/common/util/file'
import type { TurnSummary } from '@savant-code/sdk'
import type { UseMutationResult } from '@tanstack/react-query'
import type { Dispatch, MutableRefObject, Ref, SetStateAction } from 'react'

/** Props for the top-level Chat component (FID-2026-0805-003). */
export type ChatProps = {
  initialPrompt: string | null
  agentId?: string
  fileTree: FileTreeNode[]
  inputRef: MutableRefObject<MultilineInputHandle | null>
  setIsAuthenticated: Dispatch<SetStateAction<boolean | null>>
  setUser: Dispatch<SetStateAction<User | null>>
  logoutMutation: UseMutationResult<boolean, Error, void, unknown>
  continueChat: boolean
  continueChatId?: string
  authStatus: AuthStatus
  initialMode?: AgentMode
  initialPermissionMode?: PermissionMode
  gitRoot?: string | null
  onSwitchToGitRoot?: () => void
  savantFreeSession: SavantFreeSession | null
}

/**
 * Prompt submit handler produced by the messaging hook and consumed by the
 * overlays, suggestions, and keyboard wiring (FID-2026-0805-003).
 */
export type OnSubmitPrompt = (
  content: string,
  mode: AgentMode,
  options?: { preserveInputValue?: boolean },
) => Promise<CommandResult>

export type ChatSidebarProps = {
  contextTokensUsed: number
  contextTokensMax: number
  sessionCost: number
  sidebarModel: string | null | undefined
  agentId?: string
  toolsUsed: string[]
  filesChanged: FilesChanged
  agentStack: AgentStackEntry[]
  toolHistory: ToolHistoryEntry[]
  isStreaming: boolean
  isWaitingForResponse: boolean
  fsmPhase: string
  agentMode: AgentMode
}

export type ChatLayoutProps = {
  // Root
  theme: ChatTheme
  handleMouseActivity: () => void

  // Header
  headerRef: Ref<BoxRenderable>
  isHeaderVisible: boolean
  inputFocused: boolean

  // Scroll area
  scrollRef: Ref<ScrollBoxRenderable>
  appliedScrollboxProps: ChatScrollboxProps
  isStreaming: boolean
  isWaitingForResponse: boolean
  hasOverflow: boolean
  gitRoot?: string | null
  onSwitchToGitRoot?: () => void
  savantFreeSession: SavantFreeSession | null
  hiddenMessageCount: number
  onLoadPreviousMessages: () => void
  visibleTopLevelMessages: ChatMessage[]
  messageAvailableWidth: number
  pendingBashMessages: PendingBashMessageType[]

  // Bottom section
  showOnboardingPrompts: boolean
  reviewMode: boolean
  isSavantFreeSessionOver: boolean
  onSelectSuggestedPrompt: (
    prompt: string,
    selection: SuggestedPromptSelection,
  ) => void
  isCompactHeight: boolean
  shouldShowStatusLine: boolean
  timerStartTime: number | null
  isAtBottom: boolean
  scrollToLatest: () => void
  statusIndicatorState: StatusIndicatorState
  onInterruptStream: () => void
  ads: AdResponse[] | null
  showInlineAds: boolean
  onAdClick: (ad: AdResponse) => void
  onAdImpression: (ad: AdResponse) => void
  askUserState: AskUserState | null
  onReviewOptionSelect: (reviewText: string) => void
  onReviewCustom: () => void
  onCloseReviewScreen: () => void

  // Pickers
  modelPickerOpen: boolean
  modelPickerModels: OpenRouterModel[]
  modelPickerQuery: string
  modelPickerSelectedIndex: number
  onModelPickerQueryChange: (query: string) => void
  onModelPickerSelectIndex: (index: number) => void
  onModelPickerSelect: (model: OpenRouterModel) => void
  onCloseModelPicker: () => void
  providerPickerOpen: boolean
  providerPickerProviders: Array<{
    name: ProviderSetupName
    label: string
    configured: boolean
  }>
  providerPickerSelectedIndex: number
  onProviderPickerSelectIndex: (index: number) => void
  onProviderPickerSelect: (provider: ProviderSetupName) => void
  onCloseProviderPicker: () => void
  rewindPickerOpen: boolean
  rewindPickerTurns: TurnSummary[]
  rewindPickerSelectedIndex: number
  rewindPickerStage: 'choose' | 'mode'
  rewindPickerMode: RewindMode
  onRewindPickerSelectIndex: (index: number) => void
  onRewindPickerSetStage: (stage: 'choose' | 'mode') => void
  onRewindPickerSetMode: (mode: RewindMode) => void
  onRewindPickerConfirm: (turn: TurnSummary, mode: RewindMode) => void
  onCloseRewindPicker: () => void

  // Cwd + input bar
  directoryDisplay: string
  onPasteImage: () => void
  onPasteImagePath: (imagePath: string) => void
  onPasteFilePath: (filePath: string, isDirectory: boolean) => void
  inputValue: string
  cursorPosition: number
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  inputRef: { current: MultilineInputHandle | null }
  inputPlaceholder: string
  lastEditDueToNav: boolean
  agentMode: AgentMode
  toggleAgentMode: () => void
  setAgentMode: (mode: AgentMode) => void
  hasSlashSuggestions: boolean
  hasMentionSuggestions: boolean
  hasSuggestionMenu: boolean
  slashSuggestionItems: SuggestionItem[]
  agentSuggestionItems: SuggestionItem[]
  fileSuggestionItems: SuggestionItem[]
  slashSelectedIndex: number
  agentSelectedIndex: number
  onSlashItemClick: (index: number) => void
  onMentionItemClick: (index: number) => void
  terminalHeight: number
  separatorWidth: number
  shouldCenterInputVertically: boolean
  inputBoxTitle: string | undefined
  isNarrowWidth: boolean
  feedbackMode: boolean
  onExitFeedback: () => void
  publishMode: boolean
  onExitPublish: () => void
  onPublish: (agentIds: string[]) => Promise<void>
  onSubmit: () => Promise<void>
  /** FID-2026-0818-002: arbitrary-content submit for the drive confirmation. */
  onSubmitPrompt: OnSubmitPrompt

  // Sidebar
  sidebar: ChatSidebarProps
}
