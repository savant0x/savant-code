import { ChatBottomPanel } from './chat-bottom-panel'
import { ChatSidebar } from './sidebar'
import {
  CHAT_ROOT_STYLE,
  createChatScrollbarOptions,
  createChatSurfaceStyle,
  HEADER_BOX_STYLE,
  SCROLLBOX_STYLE,
} from './styles'
import { ChatHeader } from '../components/chat-header'
import { CompactionSignal } from '../components/compaction-signal'
import { DialogOverlay } from '../components/dialog-overlay'
import { LoadPreviousButton } from '../components/load-previous-button'
import { MessageWithAgents } from '../components/message-with-agents'
import { ModelPicker } from '../components/model-picker'
import { PendingBashMessage } from '../components/pending-bash-message'
import { ProviderPicker } from '../components/provider-picker'
import { RewindPicker } from '../components/rewind-picker'
import { SavantFreeActiveSessionSummary } from '../components/savant-free-active-session-summary'
import { TopBanner } from '../components/top-banner'
import { getProjectRoot } from '../project-files'
import { IS_SAVANT_FREE } from '../utils/constants'

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
    terminalHeight,
    hasOverflow,
    gitRoot,
    onSwitchToGitRoot,
    savantFreeSession,
    hiddenMessageCount,
    onLoadPreviousMessages,
    visibleTopLevelMessages,
    messageAvailableWidth,
    pendingBashMessages,
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

        <ChatBottomPanel {...props} />
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
