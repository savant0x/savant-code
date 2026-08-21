import type { OnSubmitPrompt } from './types'
import type { CommandResult } from '../commands/command-registry'
import type { MultilineInputHandle } from '../components/multiline-input'
import type {
  MatchedSlashCommand,
  TriggerContext,
} from '../hooks/use-suggestion-engine'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { AskUserState, InputValue } from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { InputMode } from '../utils/input-modes'
import type { MutableRefObject } from 'react'

export interface UseChatKeyboardAssemblyArgs {
  // Keyboard state inputs
  inputMode: InputMode
  inputValue: string
  feedbackMode: boolean
  feedbackText: string
  cursorPosition: number
  lastEditDueToNav: boolean
  isStreaming: boolean
  isWaitingForResponse: boolean
  focusedAgentId: string | null
  slashActive: boolean
  mentionActive: boolean
  slashSelectedIndex: number
  agentSelectedIndex: number
  slashMatchesLength: number
  agentMatchesLength: number
  fileMatchesLength: number
  modelPickerOpen: boolean
  nextCtrlCWillExit: boolean
  queuePaused: boolean
  queuedCount: number
  // FID-2026-0818-007: drive-mode Esc state.
  driveMode: boolean
  drivePaused: boolean
  // Handler deps
  setInputMode: (mode: InputMode) => void
  handleCloseFeedback: () => void
  setFeedbackText: (text: string) => void
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  abortControllerRef: MutableRefObject<AbortController | null>
  queuedMessagesLength: number
  pauseQueue: () => void
  setSlashSelectedIndex: (value: number | ((prev: number) => number)) => void
  slashMatches: MatchedSlashCommand[]
  slashContext: TriggerContext
  applySlashInsertText: (selected: MatchedSlashCommand) => boolean
  onSubmitPrompt: OnSubmitPrompt
  agentMode: AgentMode
  handleCommandResult: (result?: CommandResult) => void
  setAgentSelectedIndex: (value: number | ((prev: number) => number)) => void
  selectMentionAt: (index: number) => boolean
  openFileMenuWithTab: () => boolean
  navigateUp: () => void
  navigateDown: () => void
  toggleAgentMode: () => void
  setFocusedAgentId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void
  setInputFocused: (focused: boolean) => void
  inputRef: MutableRefObject<MultilineInputHandle | null>
  handleCtrlC: () => void
  clearQueue: () => void
  scrollUp: () => void
  scrollDown: () => void
  handleToggleAll: () => void
  executeSlashCommand: (
    selected: MatchedSlashCommand | undefined,
  ) => Promise<void>
  sendMessage: SendMessageFn
  // Disabled state
  askUserState: AskUserState | null
  reviewMode: boolean
  providerPickerOpen: boolean
  rewindPickerOpen: boolean
}
