import type { OnSubmitPrompt } from './types'
import type { CommandResult } from '../commands/command-registry'
import type { MultilineInputHandle } from '../components/multiline-input'
import type { AskUserState, InputValue } from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { InputMode } from '../utils/input-modes'
import type { FeedbackCategory } from '@savant-code/common/constants/feedback'
import type { MutableRefObject } from 'react'

export interface UseChatOverlaysArgs {
  onSubmitPrompt: OnSubmitPrompt
  agentMode: AgentMode
  inputValue: string
  cursorPosition: number
  inputRef: MutableRefObject<MultilineInputHandle | null>
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  setInputFocused: (focused: boolean) => void
  setInputMode: (mode: InputMode) => void
  resetHistoryNavigation: () => void
  askUserState: AskUserState | null
}

export interface UseChatOverlaysReturn {
  feedbackMode: boolean
  feedbackText: string
  setFeedbackText: (text: string) => void
  handleMessageFeedback: (
    id: string,
    options?: {
      category?: FeedbackCategory
      footerMessage?: string
      errors?: Array<{ id: string; message: string }>
    },
  ) => void
  handleCloseFeedback: () => void
  handleExitFeedback: () => void
  handleExitPublish: () => void
  handleReviewOptionSelect: (reviewText: string) => void
  handleCloseReviewScreen: () => void
  handleReviewCustom: () => void
  handlePublish: (agentIds: string[]) => Promise<void>
  handleSubmit: () => Promise<void>
  handleCommandResult: (result?: CommandResult) => void
  reviewMode: boolean
  publishMode: boolean
}
