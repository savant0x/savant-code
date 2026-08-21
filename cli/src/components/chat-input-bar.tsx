import {
  isShallowScanRoot,
  SHALLOW_SCAN_MAX_DEPTH,
} from '@savant-code/common/project-file-tree'
import React from 'react'

import { ChatInputAskUserForm } from './chat-input-bar-ask-user'
import { ChatInputCompact } from './chat-input-bar-compact'
import { ChatInputDriveConfirmation } from './chat-input-bar-drive-confirm'
import { ChatInputNormal } from './chat-input-bar-normal'
import { FeedbackContainer } from './feedback-container'
import { InputModeBanner } from './input-mode-banner'
import { OutOfCreditsBanner } from './out-of-credits-banner'
import { PublishContainer } from './publish-container'
import { parseDrivePlanForConfirmation } from '../commands/auto-drive'
import { useEvent } from '../hooks/use-event'
import { tryGetProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { shouldInterceptChatInputKey } from '../utils/chat-input-key-intercept'

import type { ChatInputBarProps } from './chat-input-bar-types'
import type { SuggestionItem } from './suggestion-menu'
import type { InputValue } from '../types/store'

export const ChatInputBar = ({
  inputValue,
  cursorPosition,
  setInputValue,
  inputFocused,
  inputRef,
  inputPlaceholder,
  lastEditDueToNav,
  agentMode,
  toggleAgentMode,
  setAgentMode,
  hasSlashSuggestions,
  hasMentionSuggestions,
  hasSuggestionMenu,
  slashSuggestionItems,
  agentSuggestionItems,
  fileSuggestionItems,
  slashSelectedIndex,
  agentSelectedIndex,
  onSlashItemClick,
  onMentionItemClick,
  theme,
  terminalHeight,
  separatorWidth,
  shouldCenterInputVertically,
  inputBoxTitle,
  directoryDisplay,
  isCompactHeight,
  isNarrowWidth,
  feedbackMode,
  handleExitFeedback,
  publishMode,
  handleExitPublish,
  handlePublish,
  handleSubmit,
  onPaste,
  onInterruptStream,
  onSubmitPrompt,
}: ChatInputBarProps) => {
  const inputMode = useChatStore((state) => state.inputMode)
  const setInputMode = useChatStore((state) => state.setInputMode)

  const askUserState = useChatStore((state) => state.askUserState)
  const driveState = useChatStore((state) => state.driveState)
  const drivePlanDraft = useChatStore((state) => state.drivePlanDraft)
  const hasAnyPreview = hasSuggestionMenu

  // In the home directory (or an ancestor) the file tree is only scanned a few
  // levels deep, so tell the user why deeper files don't show up.
  const mentionMenuFooter = isShallowScanRoot(tryGetProjectRoot())
    ? `Files shown up to ${SHALLOW_SCAN_MAX_DEPTH} levels deep — open a project folder for full results`
    : undefined

  // Increase menu size on larger screen heights
  const normalModeMaxVisible = terminalHeight > 35 ? 15 : 10

  // Shared key intercept handler for suggestion menu navigation and history navigation
  const handleKeyIntercept = useEvent(
    (key: {
      name?: string
      sequence?: string
      shift?: boolean
      ctrl?: boolean
      meta?: boolean
      option?: boolean
    }) => {
      return shouldInterceptChatInputKey(key, {
        hasSlashSuggestions,
        hasMentionSuggestions,
        lastEditDueToNav,
        cursorPosition,
        inputLength: inputValue.length,
      })
    },
  )

  // FID-2026-0818-002: present the pre-build plan for the operator's single
  // Law 2 approval. Confirm locks drive mode; Revise re-plans; Cancel exits.
  const drivePlan = drivePlanDraft
    ? parseDrivePlanForConfirmation(drivePlanDraft)
    : null
  if (driveState === 'awaiting_confirmation' && drivePlan) {
    return (
      <ChatInputDriveConfirmation
        plan={drivePlan}
        onSubmitPrompt={onSubmitPrompt}
      />
    )
  }

  if (feedbackMode) {
    return (
      <FeedbackContainer
        inputRef={inputRef}
        onExitFeedback={handleExitFeedback}
        width={separatorWidth}
      />
    )
  }

  if (publishMode) {
    return (
      <PublishContainer
        inputRef={inputRef}
        onExitPublish={handleExitPublish}
        onPublish={handlePublish}
        width={separatorWidth}
      />
    )
  }

  // FID-2026-0720-033d Phase D Step 5: the CommandPalette is rendered INLINE
  // above the input box (in both compact and normal paths below) when slash
  // suggestions are active — NOT as an early-return that hides the input.
  // This preserves the UX where the user keeps typing to refine the filter.
  // The palette consumes the same SuggestionItem[] from use-suggestion-engine
  // (Law 13 — no duplicate filtering logic). Law 4: CommandPalette is mounted
  // via this consumer.
  //
  // `handleSlashSelect` wires the palette's onSelect to the existing
  // onSlashItemClick handler (which executes the command). `handleSlashClose`
  // clears the input so the suggestion engine deactivates — Escape actually
  // closes the palette (Law 14 — no modal trap).
  const handleSlashSelect = (item: SuggestionItem) => {
    const index = slashSuggestionItems.findIndex((s) => s.id === item.id)
    if (index >= 0 && onSlashItemClick) {
      onSlashItemClick(index)
    }
  }
  const handleSlashClose = () => {
    // Clear the slash query so `hasSlashSuggestions` becomes false and the
    // palette unmounts. The suggestion engine deactivates when input no
    // longer starts with '/'.
    setInputValue({
      text: '',
      cursorPosition: 0,
      lastEditDueToNav: false,
    })
  }

  // Out of credits mode: replace entire input with out-of-credits banner
  if (inputMode === 'outOfCredits') {
    return <OutOfCreditsBanner />
  }

  // Subscription limit mode: show only the limit banner (no input box)
  if (inputMode === 'subscriptionLimit') {
    return <InputModeBanner />
  }

  // ChatGPT connect mode: show only the connect panel (no input box)
  if (inputMode === 'connect:chatgpt') {
    return <InputModeBanner />
  }

  // Handle input changes with special mode entry detection
  const handleInputChange = (value: InputValue) => {
    // Detect entering bash mode: user typed exactly '!' when in default mode
    if (inputMode === 'default' && value.text === '!') {
      // Enter bash mode and clear input
      setInputMode('bash')
      setInputValue({
        text: '',
        cursorPosition: 0,
        lastEditDueToNav: value.lastEditDueToNav,
      })
      return
    }

    // Normal input handling
    setInputValue(value)
  }

  // FID-2026-0816-007 step 5: the cwd line is folded into input-bar chrome —
  // normal mode surfaces it in the border title, compact mode as a dim line.
  const cwdLabel = `cwd: ${directoryDisplay}`
  const effectiveTitle = ` ${[cwdLabel, inputBoxTitle?.trim()]
    .filter(Boolean)
    .join('   ')} `

  if (askUserState) {
    return (
      <ChatInputAskUserForm
        theme={theme}
        onInterruptStream={onInterruptStream}
      />
    )
  }

  // Compact mode: no border, minimal chrome, supports menus and multiline
  if (isCompactHeight) {
    return (
      <ChatInputCompact
        inputValue={inputValue}
        cursorPosition={cursorPosition}
        inputRef={inputRef}
        inputFocused={inputFocused}
        feedbackMode={feedbackMode}
        theme={theme}
        terminalHeight={terminalHeight}
        inputPlaceholder={inputPlaceholder}
        hasSlashSuggestions={hasSlashSuggestions}
        slashSuggestionItems={slashSuggestionItems}
        slashSelectedIndex={slashSelectedIndex}
        hasMentionSuggestions={hasMentionSuggestions}
        agentSuggestionItems={agentSuggestionItems}
        fileSuggestionItems={fileSuggestionItems}
        agentSelectedIndex={agentSelectedIndex}
        onMentionItemClick={onMentionItemClick}
        handleSubmit={handleSubmit}
        onPaste={onPaste}
        cwdLabel={cwdLabel}
        mentionMenuFooter={mentionMenuFooter}
        onSlashSelect={handleSlashSelect}
        onSlashClose={handleSlashClose}
        onInputChange={handleInputChange}
        onKeyIntercept={handleKeyIntercept}
      />
    )
  }

  return (
    <ChatInputNormal
      inputValue={inputValue}
      cursorPosition={cursorPosition}
      inputRef={inputRef}
      inputFocused={inputFocused}
      feedbackMode={feedbackMode}
      theme={theme}
      terminalHeight={terminalHeight}
      inputPlaceholder={inputPlaceholder}
      agentMode={agentMode}
      toggleAgentMode={toggleAgentMode}
      setAgentMode={setAgentMode}
      hasSlashSuggestions={hasSlashSuggestions}
      slashSuggestionItems={slashSuggestionItems}
      slashSelectedIndex={slashSelectedIndex}
      hasMentionSuggestions={hasMentionSuggestions}
      agentSuggestionItems={agentSuggestionItems}
      fileSuggestionItems={fileSuggestionItems}
      agentSelectedIndex={agentSelectedIndex}
      onMentionItemClick={onMentionItemClick}
      shouldCenterInputVertically={shouldCenterInputVertically}
      isNarrowWidth={isNarrowWidth}
      handleSubmit={handleSubmit}
      onPaste={onPaste}
      effectiveTitle={effectiveTitle}
      mentionMenuFooter={mentionMenuFooter}
      normalModeMaxVisible={normalModeMaxVisible}
      hasAnyPreview={hasAnyPreview}
      onSlashSelect={handleSlashSelect}
      onSlashClose={handleSlashClose}
      onInputChange={handleInputChange}
      onKeyIntercept={handleKeyIntercept}
    />
  )
}
