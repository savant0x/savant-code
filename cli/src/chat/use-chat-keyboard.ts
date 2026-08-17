/**
 * Keyboard state + handlers assembly for the chat screen (FID-2026-0805-003).
 * Extracted from chat.tsx verbatim: the two memo builders and the
 * useChatKeyboard mount. Deps arrays are kept identical to the originals to
 * preserve rebuild cadence; some deps (onSubmitPrompt, agentMode,
 * handleCommandResult) are intentionally kept even though the memoized
 * closures delegate through other handlers — removing them would change when
 * the handler set rebuilds.
 */

import { useMemo } from 'react'

import { buildChatKeyboardHandlers, buildChatKeyboardState } from './keyboard'
import { useChatKeyboard } from '../hooks/use-chat-keyboard'

import type { OnSubmitPrompt } from './types'
import type { CommandResult } from '../commands/command-registry'
import type { MultilineInputHandle } from '../components/multiline-input'
import type { ChatKeyboardHandlers } from '../hooks/use-chat-keyboard'
import type {
  MatchedSlashCommand,
  TriggerContext,
} from '../hooks/use-suggestion-engine'
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
  // Disabled state
  askUserState: AskUserState | null
  reviewMode: boolean
  providerPickerOpen: boolean
  rewindPickerOpen: boolean
}

export function useChatKeyboardAssembly(args: UseChatKeyboardAssemblyArgs): {
  chatKeyboardHandlers: ChatKeyboardHandlers
} {
  const {
    inputMode,
    inputValue,
    feedbackMode,
    feedbackText,
    cursorPosition,
    lastEditDueToNav,
    isStreaming,
    isWaitingForResponse,
    focusedAgentId,
    slashActive,
    mentionActive,
    slashSelectedIndex,
    agentSelectedIndex,
    slashMatchesLength,
    agentMatchesLength,
    fileMatchesLength,
    modelPickerOpen,
    nextCtrlCWillExit,
    queuePaused,
    queuedCount,
    setInputMode,
    handleCloseFeedback,
    setFeedbackText,
    setInputValue,
    abortControllerRef,
    queuedMessagesLength,
    pauseQueue,
    setSlashSelectedIndex,
    slashMatches,
    slashContext,
    applySlashInsertText,
    onSubmitPrompt,
    agentMode,
    handleCommandResult,
    setAgentSelectedIndex,
    selectMentionAt,
    openFileMenuWithTab,
    navigateUp,
    navigateDown,
    toggleAgentMode,
    setFocusedAgentId,
    setInputFocused,
    inputRef,
    handleCtrlC,
    clearQueue,
    scrollUp,
    scrollDown,
    handleToggleAll,
    executeSlashCommand,
    askUserState,
    reviewMode,
    providerPickerOpen,
    rewindPickerOpen,
  } = args

  const totalMentionMatches = agentMatchesLength + fileMatchesLength
  const historyNavUpEnabled =
    lastEditDueToNav ||
    (cursorPosition === 0 &&
      ((slashActive && slashSelectedIndex === 0) ||
        (mentionActive && agentSelectedIndex === 0) ||
        (!slashActive && !mentionActive)))
  const historyNavDownEnabled =
    lastEditDueToNav ||
    (cursorPosition === inputValue.length &&
      ((slashActive && slashSelectedIndex === slashMatchesLength - 1) ||
        (mentionActive && agentSelectedIndex === totalMentionMatches - 1) ||
        (!slashActive && !mentionActive)))

  // Build keyboard state from store values
  const chatKeyboardState = useMemo(
    () =>
      buildChatKeyboardState({
        inputMode,
        inputValue,
        feedbackMode,
        feedbackText,
        cursorPosition,
        isStreaming,
        isWaitingForResponse,
        focusedAgentId,
        slashMenuActive: slashActive,
        mentionMenuActive: mentionActive,
        slashSelectedIndex,
        agentSelectedIndex,
        slashMatchesLength,
        totalMentionMatches,
        modelPickerOpen,
        historyNavUpEnabled,
        historyNavDownEnabled,
        nextCtrlCWillExit,
        queuePaused,
        queuedCount,
      }),
    [
      inputMode,
      inputValue,
      feedbackText,
      cursorPosition,
      isStreaming,
      isWaitingForResponse,
      feedbackMode,
      focusedAgentId,
      slashActive,
      mentionActive,
      slashSelectedIndex,
      agentSelectedIndex,
      slashMatchesLength,
      agentMatchesLength,
      fileMatchesLength,
      historyNavUpEnabled,
      historyNavDownEnabled,
      nextCtrlCWillExit,
      queuePaused,
      queuedCount,
    ],
  )

  // Keyboard handlers
  const chatKeyboardHandlers = useMemo(
    () =>
      buildChatKeyboardHandlers({
        setInputMode,
        handleCloseFeedback,
        setFeedbackText,
        setInputValue,
        abortControllerRef,
        queuedMessagesLength,
        pauseQueue,
        setSlashSelectedIndex,
        slashMatches,
        slashSelectedIndex,
        slashContext,
        inputValue,
        applySlashInsertText,
        onSubmitPrompt,
        agentMode,
        handleCommandResult,
        setAgentSelectedIndex,
        agentSelectedIndex,
        selectMentionAt,
        openFileMenuWithTab,
        navigateUp,
        navigateDown,
        toggleAgentMode,
        setFocusedAgentId,
        setInputFocused,
        inputRef,
        handleCtrlC,
        clearQueue,
        scrollUp,
        scrollDown,
        handleToggleAll,
        totalMentionMatches,
        executeSlashCommand,
      }),
    [
      setInputMode,
      handleCloseFeedback,
      setFeedbackText,
      setInputValue,
      abortControllerRef,
      queuedMessagesLength,
      pauseQueue,
      setSlashSelectedIndex,
      slashMatches,
      slashSelectedIndex,
      slashContext,
      inputValue,
      applySlashInsertText,
      onSubmitPrompt,
      agentMode,
      handleCommandResult,
      setAgentSelectedIndex,
      agentSelectedIndex,
      selectMentionAt,
      openFileMenuWithTab,
      navigateUp,
      navigateDown,
      toggleAgentMode,
      setFocusedAgentId,
      setInputFocused,
      inputRef,
      handleCtrlC,
      clearQueue,
      scrollUp,
      scrollDown,
      handleToggleAll,
    ],
  )

  // Use the chat keyboard hook
  useChatKeyboard({
    state: chatKeyboardState,
    handlers: chatKeyboardHandlers,
    // Disable the global keyboard dispatcher while the model or provider picker
    // overlay is open so its own useKeyboard handler has exclusive control.
    disabled:
      askUserState !== null ||
      reviewMode ||
      modelPickerOpen ||
      providerPickerOpen ||
      rewindPickerOpen,
  })

  return { chatKeyboardHandlers }
}
