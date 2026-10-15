import { BOTTOM_BOX_STYLE } from './styles'
import { SingleAdBanner } from '../components/ad-banner'
import { ChatInputBar } from '../components/chat-input-bar'
import { ReviewScreen } from '../components/review-screen'
import { SessionEndedBanner } from '../components/session-ended-banner'
import { StatusBar } from '../components/status-bar'
import { SuggestedPrompts } from '../components/suggested-prompts'
import { returnToSavantFreeLanding } from '../hooks/use-savant-free-session'
import { getProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { showClipboardMessage } from '../utils/clipboard'
import { END_SESSION_MESSAGE } from '../utils/constants'
import { getSystemMessage } from '../utils/message-history'
import { createPasteHandler } from '../utils/strings'

import type { ChatLayoutProps } from './types'

type ChatBottomPanelProps = Pick<
  ChatLayoutProps,
  | 'theme'
  | 'savantFreeSession'
  | 'inputFocused'
  | 'isStreaming'
  | 'isWaitingForResponse'
  | 'showOnboardingPrompts'
  | 'reviewMode'
  | 'isSavantFreeSessionOver'
  | 'onSelectSuggestedPrompt'
  | 'isCompactHeight'
  | 'shouldShowStatusLine'
  | 'timerStartTime'
  | 'isAtBottom'
  | 'scrollToLatest'
  | 'statusIndicatorState'
  | 'onInterruptStream'
  | 'ads'
  | 'showInlineAds'
  | 'onAdClick'
  | 'onAdImpression'
  | 'askUserState'
  | 'onReviewOptionSelect'
  | 'onReviewCustom'
  | 'onCloseReviewScreen'
  | 'directoryDisplay'
  | 'onPasteImage'
  | 'onPasteImagePath'
  | 'onPasteFilePath'
  | 'inputValue'
  | 'cursorPosition'
  | 'setInputValue'
  | 'inputRef'
  | 'inputPlaceholder'
  | 'lastEditDueToNav'
  | 'agentMode'
  | 'toggleAgentMode'
  | 'setAgentMode'
  | 'hasSlashSuggestions'
  | 'hasMentionSuggestions'
  | 'hasSuggestionMenu'
  | 'slashSuggestionItems'
  | 'agentSuggestionItems'
  | 'fileSuggestionItems'
  | 'slashSelectedIndex'
  | 'agentSelectedIndex'
  | 'onSlashItemClick'
  | 'onMentionItemClick'
  | 'terminalHeight'
  | 'separatorWidth'
  | 'shouldCenterInputVertically'
  | 'inputBoxTitle'
  | 'isNarrowWidth'
  | 'feedbackMode'
  | 'onExitFeedback'
  | 'publishMode'
  | 'onExitPublish'
  | 'onPublish'
  | 'onSubmit'
  | 'onSubmitPrompt'
>

export function ChatBottomPanel(props: ChatBottomPanelProps) {
  const {
    theme,
    savantFreeSession,
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
    onSubmitPrompt,
  } = props

  return (
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
        <ReviewScreen
          onSelectOption={onReviewOptionSelect}
          onCustom={onReviewCustom}
          onCancel={onCloseReviewScreen}
        />
      ) : isSavantFreeSessionOver && !askUserState ? (
        <SessionEndedBanner
          isStreaming={props.isStreaming || props.isWaitingForResponse}
        />
      ) : (
        <ChatInputBar
          inputValue={inputValue}
          cursorPosition={cursorPosition}
          setInputValue={setInputValue}
          inputFocused={props.inputFocused}
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
          onSubmitPrompt={onSubmitPrompt}
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
              showClipboardMessage(
                `📋 Pasted text (${pastedText.length.toLocaleString()} chars)`,
                { durationMs: 5000 },
              )
            },
            cwd: getProjectRoot() ?? process.cwd(),
          })}
          onInterruptStream={onInterruptStream}
        />
      )}
    </box>
  )
}
