import { ChatSidebar } from './sidebar'
import {
  BOTTOM_BOX_STYLE,
  CHAT_ROOT_STYLE,
  createChatScrollbarOptions,
  createChatSurfaceStyle,
  HEADER_BOX_STYLE,
  SCROLLBOX_STYLE,
} from './styles'
import { SingleAdBanner } from '../components/ad-banner'
import { ChatHeader } from '../components/chat-header'
import { ChatInputBar } from '../components/chat-input-bar'
import { CompactionSignal } from '../components/compaction-signal'
import { DialogOverlay } from '../components/dialog-overlay'
import { LoadPreviousButton } from '../components/load-previous-button'
import { MessageWithAgents } from '../components/message-with-agents'
import { ModelPicker } from '../components/model-picker'
import { PendingBashMessage } from '../components/pending-bash-message'
import { ProviderPicker } from '../components/provider-picker'
import { ReviewScreen } from '../components/review-screen'
import { RewindPicker } from '../components/rewind-picker'
import { SavantFreeActiveSessionSummary } from '../components/savant-free-active-session-summary'
import { SessionEndedBanner } from '../components/session-ended-banner'
import { StatusBar } from '../components/status-bar'
import { SuggestedPrompts } from '../components/suggested-prompts'
import { TopBanner } from '../components/top-banner'
import { returnToSavantFreeLanding } from '../hooks/use-savant-free-session'
import { getProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { showClipboardMessage } from '../utils/clipboard'
import { END_SESSION_MESSAGE, IS_SAVANT_FREE } from '../utils/constants'
import { getSystemMessage } from '../utils/message-history'
import { createPasteHandler } from '../utils/strings'

import type { ChatLayoutProps } from './types'

/**
 * Presentational layout of the chat screen (FID-2026-0805-003). Extracted
 * from chat.tsx verbatim; all logic stays in the parent controller.
 */
export function ChatLayout(props: ChatLayoutProps) {
  const {
    theme,
    handleMouseActivity,
    headerRef,
    isHeaderVisible,
    inputFocused,
    scrollRef,
    appliedScrollboxProps,
    isStreaming,
    isWaitingForResponse,
    hasOverflow,
    gitRoot,
    onSwitchToGitRoot,
    savantFreeSession,
    hiddenMessageCount,
    onLoadPreviousMessages,
    visibleTopLevelMessages,
    messageAvailableWidth,
    pendingBashMessages,
    showOnboardingPrompts,
    reviewMode,
    isSavantFreeSessionOver,
    onSelectSuggestedPrompt,
    isCompactHeight,
    shouldShowStatusLine,
    timerStartTime,
    isAtBottom,
    scrollToLatest,
    statusIndicatorState,
    onInterruptStream,
    ads,
    showInlineAds,
    onAdClick,
    onAdImpression,
    askUserState,
    onReviewOptionSelect,
    onReviewCustom,
    onCloseReviewScreen,
    modelPickerOpen,
    modelPickerModels,
    modelPickerQuery,
    modelPickerSelectedIndex,
    onModelPickerQueryChange,
    onModelPickerSelectIndex,
    onModelPickerSelect,
    onCloseModelPicker,
    providerPickerOpen,
    providerPickerProviders,
    providerPickerSelectedIndex,
    onProviderPickerSelectIndex,
    onProviderPickerSelect,
    onCloseProviderPicker,
    rewindPickerOpen,
    rewindPickerTurns,
    rewindPickerSelectedIndex,
    rewindPickerStage,
    rewindPickerMode,
    onRewindPickerSelectIndex,
    onRewindPickerSetStage,
    onRewindPickerSetMode,
    onRewindPickerConfirm,
    onCloseRewindPicker,
    directoryDisplay,
    onPasteImage,
    onPasteImagePath,
    onPasteFilePath,
    inputValue,
    cursorPosition,
    setInputValue,
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
    terminalHeight,
    separatorWidth,
    shouldCenterInputVertically,
    inputBoxTitle,
    isNarrowWidth,
    feedbackMode,
    onExitFeedback,
    publishMode,
    onExitPublish,
    onPublish,
    onSubmit,
    sidebar,
  } = props

  return (
    <box
      onMouseMove={handleMouseActivity}
      focusable={false}
      style={CHAT_ROOT_STYLE}
    >
      {/* Left column: chat content + bottom section */}
      <box
        focusable={false}
        style={{
          ...createChatSurfaceStyle(theme.background),
          flexDirection: 'column',
          gap: 0,
          borderStyle: 'single',
          borderColor: theme.border,
        }}
      >
        {/* Pinned header — outside scrollbox so it stays at top */}
        <box ref={headerRef} style={HEADER_BOX_STYLE} focusable={false}>
          <ChatHeader
            projectRoot={getProjectRoot()}
            animationEnabled={isHeaderVisible && inputFocused}
          />
        </box>

        <scrollbox
          ref={scrollRef}
          stickyScroll
          stickyStart="bottom"
          scrollX={false}
          scrollbarOptions={{ visible: false }}
          verticalScrollbarOptions={{
            visible: !isStreaming && !isWaitingForResponse && hasOverflow,
            ...createChatScrollbarOptions(theme.background, theme.primary),
          }}
          {...appliedScrollboxProps}
          style={SCROLLBOX_STYLE}
        >
          <TopBanner gitRoot={gitRoot} onSwitchToGitRoot={onSwitchToGitRoot} />

          {IS_SAVANT_FREE && (
            <SavantFreeActiveSessionSummary session={savantFreeSession} />
          )}
          {hiddenMessageCount > 0 && (
            <LoadPreviousButton
              hiddenCount={hiddenMessageCount}
              onLoadMore={onLoadPreviousMessages}
            />
          )}
          {visibleTopLevelMessages.map((message, idx) => (
            <MessageWithAgents
              key={message.id}
              message={message}
              depth={0}
              isLastMessage={idx === visibleTopLevelMessages.length - 1}
              availableWidth={messageAvailableWidth}
            />
          ))}
          {/* Pending bash messages as ghost messages (only show those not already in history) */}
          {pendingBashMessages
            .filter((msg) => !msg.addedToHistory)
            .map((msg) => (
              <PendingBashMessage
                key={`pending-bash-${msg.id}`}
                message={msg}
              />
            ))}
          {/* FID-2026-0814-006: in-stream compaction lifecycle signal (kimi
              pattern). Render-only — never enters messageHistory, so the ECHO
              compliance accounting is untouched. Shows ⚙ Compacting… while a
              pruner runs and the terminal ✓/⚠ outcome once per lifecycle. */}
          <CompactionSignal />
        </scrollbox>

        <box focusable={false} style={BOTTOM_BOX_STYLE}>
          {showOnboardingPrompts && !reviewMode && !isSavantFreeSessionOver && (
            <SuggestedPrompts
              onSelect={onSelectSuggestedPrompt}
              maxItems={isCompactHeight ? 2 : undefined}
            />
          )}

          {shouldShowStatusLine && (
            <StatusBar
              timerStartTime={timerStartTime}
              isAtBottom={isAtBottom}
              scrollToLatest={scrollToLatest}
              statusIndicatorState={statusIndicatorState}
              onStop={onInterruptStream}
              onEndSession={() => {
                useChatStore
                  .getState()
                  .setMessages((prev) => [
                    ...prev,
                    getSystemMessage(END_SESSION_MESSAGE),
                  ])
                returnToSavantFreeLanding({ resetChat: true }).catch(() => {})
              }}
              savantFreeSession={savantFreeSession}
            />
          )}

          {ads?.[0] && showInlineAds && (
            <SingleAdBanner
              ad={ads[0]}
              onClick={onAdClick}
              onImpression={onAdImpression}
            />
          )}

          {reviewMode ? (
            // Review and ask_user take precedence over the session-ended banner:
            // during the grace window the agent may still be asking to run tools
            // or asking the user a question, and those approvals/answers must be
            // reachable for the run to finish — otherwise the agent hangs
            // waiting for input that can never be given.
            <ReviewScreen
              onSelectOption={onReviewOptionSelect}
              onCustom={onReviewCustom}
              onCancel={onCloseReviewScreen}
            />
          ) : isSavantFreeSessionOver && !askUserState ? (
            <SessionEndedBanner
              isStreaming={isStreaming || isWaitingForResponse}
            />
          ) : (
            <>
              <ChatInputBar
                inputValue={inputValue}
                cursorPosition={cursorPosition}
                setInputValue={setInputValue}
                inputFocused={inputFocused}
                inputRef={inputRef}
                inputPlaceholder={inputPlaceholder}
                lastEditDueToNav={lastEditDueToNav}
                agentMode={agentMode}
                toggleAgentMode={toggleAgentMode}
                setAgentMode={setAgentMode}
                hasSlashSuggestions={hasSlashSuggestions}
                hasMentionSuggestions={hasMentionSuggestions}
                hasSuggestionMenu={hasSuggestionMenu}
                slashSuggestionItems={slashSuggestionItems}
                agentSuggestionItems={agentSuggestionItems}
                fileSuggestionItems={fileSuggestionItems}
                slashSelectedIndex={slashSelectedIndex}
                agentSelectedIndex={agentSelectedIndex}
                onSlashItemClick={onSlashItemClick}
                onMentionItemClick={onMentionItemClick}
                theme={theme}
                terminalHeight={terminalHeight}
                separatorWidth={separatorWidth}
                shouldCenterInputVertically={shouldCenterInputVertically}
                inputBoxTitle={inputBoxTitle}
                directoryDisplay={directoryDisplay}
                isCompactHeight={isCompactHeight}
                isNarrowWidth={isNarrowWidth}
                feedbackMode={feedbackMode}
                handleExitFeedback={onExitFeedback}
                publishMode={publishMode}
                handleExitPublish={onExitPublish}
                handlePublish={onPublish}
                handleSubmit={onSubmit}
                onPaste={createPasteHandler({
                  text: inputValue,
                  cursorPosition,
                  onChange: setInputValue,
                  onPasteImage,
                  onPasteImagePath,
                  onPasteFilePath,
                  onPasteLongText: (pastedText) => {
                    const id = crypto.randomUUID()
                    const preview = pastedText.slice(0, 100).replace(/\n/g, ' ')
                    useChatStore.getState().addPendingTextAttachment({
                      id,
                      content: pastedText,
                      preview,
                      charCount: pastedText.length,
                    })
                    // Show temporary status message
                    showClipboardMessage(
                      `📋 Pasted text (${pastedText.length.toLocaleString()} chars)`,
                      { durationMs: 5000 },
                    )
                  },
                  cwd: getProjectRoot() ?? process.cwd(),
                })}
                onInterruptStream={onInterruptStream}
              />
            </>
          )}
        </box>
      </box>

      <ChatSidebar {...sidebar} />

      {/* FID-2026-0816-007 step 2: pickers render as centered dialog overlays
          (dimmed backdrop + entry/exit animation) instead of inline stack. */}
      {modelPickerOpen && (
        <DialogOverlay onClose={onCloseModelPicker}>
          {(requestClose) => (
            <ModelPicker
              models={modelPickerModels}
              query={modelPickerQuery}
              selectedIndex={modelPickerSelectedIndex}
              onQueryChange={onModelPickerQueryChange}
              onSelectIndex={onModelPickerSelectIndex}
              onSelect={onModelPickerSelect}
              onClose={requestClose}
              terminalHeight={terminalHeight}
            />
          )}
        </DialogOverlay>
      )}
      {providerPickerOpen && (
        <DialogOverlay onClose={onCloseProviderPicker}>
          {(requestClose) => (
            <ProviderPicker
              providers={providerPickerProviders}
              selectedIndex={providerPickerSelectedIndex}
              onSelectIndex={onProviderPickerSelectIndex}
              onSelect={onProviderPickerSelect}
              onClose={requestClose}
              terminalHeight={terminalHeight}
            />
          )}
        </DialogOverlay>
      )}
      {rewindPickerOpen && (
        <DialogOverlay onClose={onCloseRewindPicker}>
          {(requestClose) => (
            <RewindPicker
              turns={rewindPickerTurns}
              selectedIndex={rewindPickerSelectedIndex}
              stage={rewindPickerStage}
              mode={rewindPickerMode}
              onSelectIndex={onRewindPickerSelectIndex}
              onSetStage={onRewindPickerSetStage}
              onSetMode={onRewindPickerSetMode}
              onConfirm={onRewindPickerConfirm}
              onClose={requestClose}
            />
          )}
        </DialogOverlay>
      )}
    </box>
  )
}
