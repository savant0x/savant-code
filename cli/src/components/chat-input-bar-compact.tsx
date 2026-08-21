import React from 'react'

import { CommandPalette } from './command-palette'
import { DriveBanner } from './drive-mode/banner'
import { InputModeBanner } from './input-mode-banner'
import { MultilineInput } from './multiline-input'
import { SuggestionMenu, type SuggestionItem } from './suggestion-menu'
import { useChatStore } from '../state/chat-store'
import { getInputModeConfig } from '../utils/input-modes'

import type { ChatInputBarProps } from './chat-input-bar-types'
import type { InputValue } from '../types/store'

interface ChatInputCompactProps extends Pick<
  ChatInputBarProps,
  | 'inputValue'
  | 'cursorPosition'
  | 'inputRef'
  | 'inputFocused'
  | 'feedbackMode'
  | 'theme'
  | 'terminalHeight'
  | 'inputPlaceholder'
  | 'hasSlashSuggestions'
  | 'slashSuggestionItems'
  | 'slashSelectedIndex'
  | 'hasMentionSuggestions'
  | 'agentSuggestionItems'
  | 'fileSuggestionItems'
  | 'agentSelectedIndex'
  | 'onMentionItemClick'
  | 'handleSubmit'
  | 'onPaste'
> {
  cwdLabel: string
  mentionMenuFooter: string | undefined
  onSlashSelect: (item: SuggestionItem) => void
  onSlashClose: () => void
  onInputChange: (value: InputValue) => void
  onKeyIntercept: React.ComponentProps<typeof MultilineInput>['onKeyIntercept']
}

/**
 * Compact-height branch of the chat input bar: no border, minimal chrome,
 * supports menus and multiline (FID-2026-0819-005 Loop 137).
 */
export const ChatInputCompact = ({
  inputValue,
  cursorPosition,
  inputRef,
  inputFocused,
  feedbackMode,
  theme,
  terminalHeight,
  inputPlaceholder,
  hasSlashSuggestions,
  slashSuggestionItems,
  slashSelectedIndex,
  hasMentionSuggestions,
  agentSuggestionItems,
  fileSuggestionItems,
  agentSelectedIndex,
  onMentionItemClick,
  handleSubmit,
  onPaste,
  cwdLabel,
  mentionMenuFooter,
  onSlashSelect,
  onSlashClose,
  onInputChange,
  onKeyIntercept,
}: ChatInputCompactProps) => {
  const inputMode = useChatStore((state) => state.inputMode)
  const driveMode = useChatStore((state) => state.driveMode)
  const modeConfig = getInputModeConfig(inputMode)
  const effectivePlaceholder =
    inputMode === 'default' ? inputPlaceholder : modeConfig.placeholder
  const compactMaxHeight = Math.floor(terminalHeight / 2)

  return (
    <>
      {/* FID-2026-0816-007 step 5: compact mode has no border title, so the
          cwd line is folded in as a single dim row above the input. */}
      <text
        fg={theme.muted}
        wrapMode="none"
        selectable={false}
        style={{ paddingLeft: 1 }}
      >
        {cwdLabel}
      </text>
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
          maxVisible={5}
          prefix="@"
          onItemClick={onMentionItemClick}
          footer={mentionMenuFooter}
        />
      ) : null}
      <box
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
          gap: 1,
          backgroundColor: theme.surface,
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
        {/* In default modes the compact box has no border or label, so it can
            read as a passive status line. A shell-style prompt glyph signals
            that it's a focusable input — costs no extra height. */}
        {!modeConfig.label && !modeConfig.icon && (
          <box style={{ flexShrink: 0 }}>
            <text fg={theme.success} selectable={false}>
              ❯
            </text>
          </box>
        )}
        <MultilineInput
          value={inputValue}
          onChange={onInputChange}
          onSubmit={handleSubmit}
          onPaste={onPaste}
          onKeyIntercept={onKeyIntercept}
          placeholder={effectivePlaceholder}
          focused={inputFocused && !feedbackMode}
          maxHeight={compactMaxHeight}
          ref={inputRef}
          cursorPosition={cursorPosition}
          maskInput={
            inputMode === 'providerSetup' || inputMode === 'researchKeySetup'
          }
        />
      </box>
      {driveMode ? <DriveBanner /> : null}
      <InputModeBanner />
    </>
  )
}
