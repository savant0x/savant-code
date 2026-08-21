import type { MultilineInputHandle } from './multiline-input'
import type { SuggestionItem } from './suggestion-menu'
import type { OnSubmitPrompt } from '../chat/types'
import type { useTheme } from '../hooks/use-theme'
import type { InputValue } from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { MutableRefObject } from 'react'

export type Theme = ReturnType<typeof useTheme>

export interface ChatInputBarProps {
  // Input state
  inputValue: string
  cursorPosition: number
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  inputFocused: boolean
  inputRef: MutableRefObject<MultilineInputHandle | null>
  inputPlaceholder: string
  lastEditDueToNav: boolean

  // Agent mode
  agentMode: AgentMode
  toggleAgentMode: () => void
  setAgentMode: (mode: AgentMode) => void

  // Suggestion menus
  hasSlashSuggestions: boolean
  hasMentionSuggestions: boolean
  hasSuggestionMenu: boolean
  slashSuggestionItems: SuggestionItem[]
  agentSuggestionItems: SuggestionItem[]
  fileSuggestionItems: SuggestionItem[]
  slashSelectedIndex: number
  agentSelectedIndex: number
  onSlashItemClick?: (index: number) => void
  onMentionItemClick?: (index: number) => void

  // Layout
  theme: Theme
  terminalHeight: number
  separatorWidth: number
  shouldCenterInputVertically: boolean
  inputBoxTitle: string | undefined
  directoryDisplay: string
  isCompactHeight: boolean
  isNarrowWidth: boolean

  // Feedback mode
  feedbackMode: boolean
  handleExitFeedback: () => void

  // Publish mode
  publishMode: boolean
  handleExitPublish: () => void
  handlePublish: (agentIds: string[]) => Promise<void>

  // Handlers
  handleSubmit: () => Promise<void>
  onPaste: (fallbackText?: string) => void
  onInterruptStream: () => void
  /** FID-2026-0818-002: arbitrary-content submit for the drive confirmation. */
  onSubmitPrompt: OnSubmitPrompt
}
