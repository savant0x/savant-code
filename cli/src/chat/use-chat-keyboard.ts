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

import type { UseChatKeyboardAssemblyArgs } from './use-chat-keyboard-types'
import type { ChatKeyboardHandlers } from '../hooks/use-chat-keyboard'

export type { UseChatKeyboardAssemblyArgs } from './use-chat-keyboard-types'

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
    driveMode,
    drivePaused,
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
    sendMessage,
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
        driveMode,
        drivePaused,
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
      driveMode,
      drivePaused,
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
        sendMessage,
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
      sendMessage,
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
