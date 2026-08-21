import React from 'react'

import { AgentModeToggle } from './agent-mode-toggle'
import { CommandPalette } from './command-palette'
import { DriveBanner } from './drive-mode/banner'
import { InputModeBanner } from './input-mode-banner'
import { MultilineInput } from './multiline-input'
import { SuggestionMenu, type SuggestionItem } from './suggestion-menu'
import { useChatStore } from '../state/chat-store'
import { getInputModeConfig } from '../utils/input-modes'

import type { ChatInputBarProps } from './chat-input-bar-types'
import type { InputValue } from '../types/store'

interface ChatInputNormalProps extends Pick<
  ChatInputBarProps,
  | 'inputValue'
  | 'cursorPosition'
  | 'inputRef'
  | 'inputFocused'
  | 'feedbackMode'
  | 'theme'
  | 'terminalHeight'
  | 'inputPlaceholder'
  | 'agentMode'
  | 'toggleAgentMode'
  | 'setAgentMode'
  | 'hasSlashSuggestions'
  | 'slashSuggestionItems'
  | 'slashSelectedIndex'
  | 'hasMentionSuggestions'
  | 'agentSuggestionItems'
  | 'fileSuggestionItems'
  | 'agentSelectedIndex'
  | 'onMentionItemClick'
  | 'shouldCenterInputVertically'
  | 'isNarrowWidth'
  | 'handleSubmit'
  | 'onPaste'
> {
  effectiveTitle: string
  mentionMenuFooter: string | undefined
  normalModeMaxVisible: number
  hasAnyPreview: boolean
  onSlashSelect: (item: SuggestionItem) => void
  onSlashClose: () => void
  onInputChange: (value: InputValue) => void
  onKeyIntercept: React.ComponentProps<typeof MultilineInput>['onKeyIntercept']
}

/**
 * Normal-height branch of the chat input bar: bordered input box with mode
 * label/icon, suggestion overlays, and the agent-mode toggle
 * (FID-2026-0819-005 Loop 137).
 */
export const ChatInputNormal = ({
  inputValue,
  cursorPosition,
  inputRef,
  inputFocused,
  feedbackMode,
  theme,
  terminalHeight,
  inputPlaceholder,
  agentMode,
  toggleAgentMode,
  setAgentMode,
  hasSlashSuggestions,
  slashSuggestionItems,
  slashSelectedIndex,
  hasMentionSuggestions,
  agentSuggestionItems,
  fileSuggestionItems,
  agentSelectedIndex,
  onMentionItemClick,
  shouldCenterInputVertically,
  isNarrowWidth,
  handleSubmit,
  onPaste,
  effectiveTitle,
  mentionMenuFooter,
  normalModeMaxVisible,
  hasAnyPreview,
  onSlashSelect,
  onSlashClose,
  onInputChange,
  onKeyIntercept,
}: ChatInputNormalProps) => {
  const inputMode = useChatStore((state) => state.inputMode)
  const driveMode = useChatStore((state) => state.driveMode)
  const modeConfig = getInputModeConfig(inputMode)
  const effectivePlaceholder =
    inputMode === 'default' ? inputPlaceholder : modeConfig.placeholder

  return (
    <>
      {driveMode ? <DriveBanner /> : null}
      <box
        title={effectiveTitle}
        titleAlignment="center"
        style={{
          width: '100%',
          borderStyle: 'single',
          borderColor: theme.border,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 0,
          paddingBottom: 0,
          flexDirection: 'column',
          gap: hasAnyPreview ? 1 : 0,
        }}
      >
        {/* FID-033d Phase D: slash commands now render as the CommandPalette
            overlay (native <select>) inline above the input. Mention (@)
            suggestions still use the inline SuggestionMenu. */}
        {hasSlashSuggestions ? (
          <CommandPalette
            items={slashSuggestionItems}
            prefix="/"
            selectedIndex={slashSelectedIndex}
            title="Slash Commands"
            onSelect={onSlashSelect}
            onClose={onSlashClose}
          />
        ) : null}
        {hasMentionSuggestions ? (
          <SuggestionMenu
            items={[...agentSuggestionItems, ...fileSuggestionItems]}
            selectedIndex={agentSelectedIndex}
            maxVisible={normalModeMaxVisible}
            prefix="@"
            onItemClick={onMentionItemClick}
            footer={mentionMenuFooter}
          />
        ) : null}
        <box
          style={{
            flexDirection: 'column',
            justifyContent: shouldCenterInputVertically
              ? 'center'
              : 'flex-start',
            minHeight: shouldCenterInputVertically ? 3 : undefined,
            gap: 0,
          }}
        >
          <box
            style={{
              flexDirection: 'row',
              alignItems: shouldCenterInputVertically ? 'center' : 'flex-start',
              gap: 1,
              width: '100%',
            }}
          >
            {modeConfig.label && (
              <box
                style={{
                  flexShrink: 0,
                  paddingLeft: 1,
                  paddingRight: 1,
                  backgroundColor: theme.info,
                }}
              >
                <text fg={theme.background} selectable={false}>
                  {modeConfig.label}
                </text>
              </box>
            )}
            {modeConfig.icon && (
              <box style={{ flexShrink: 0 }}>
                <text fg={theme[modeConfig.color]} selectable={false}>
                  {modeConfig.icon}
                </text>
              </box>
            )}
            <box style={{ flexGrow: 1, minWidth: 0 }}>
              <MultilineInput
                value={inputValue}
                onChange={onInputChange}
                onSubmit={handleSubmit}
                onPaste={onPaste}
                onKeyIntercept={onKeyIntercept}
                placeholder={effectivePlaceholder}
                focused={inputFocused && !feedbackMode}
                maxHeight={Math.floor(terminalHeight / 2)}
                ref={inputRef}
                cursorPosition={cursorPosition}
              />
            </box>
            {modeConfig.showAgentModeToggle && !isNarrowWidth && (
              <box
                style={{
                  flexShrink: 0,
                  paddingLeft: 2,
                }}
              >
                <AgentModeToggle
                  mode={agentMode}
                  onToggle={toggleAgentMode}
                  onSelectMode={setAgentMode}
                />
              </box>
            )}
          </box>
        </box>
      </box>
      <InputModeBanner />
    </>
  )
}
