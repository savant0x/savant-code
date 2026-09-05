import { getInputModeConfig } from './input-modes'
import {
  resolveMentionMenuAction,
  resolveSlashMenuAction,
} from './keyboard-menu-actions'
import { isPlainEnterKey } from './terminal-enter-detection'

import type {
  ChatKeyboardAction,
  ChatKeyboardState,
} from './keyboard-action-types'
import type { KeyEvent } from '@opentui/core'

export type {
  ChatKeyboardAction,
  ChatKeyboardState,
} from './keyboard-action-types'

const hasModifier = (key: KeyEvent) =>
  Boolean(key.ctrl || key.meta || key.option)

/**
 * Pure function that resolves a keyboard action based on key event and state.
 * This implements the priority-based keyboard handling logic.
 */
export function resolveChatKeyboardAction(
  key: KeyEvent,
  state: ChatKeyboardState,
): ChatKeyboardAction {
  const isEscape = key.name === 'escape'
  const isCtrlC = key.ctrl && key.name === 'c'
  const isCtrlV = key.ctrl && key.name === 'v'
  const isBackspace = key.name === 'backspace'
  const isUp = key.name === 'up' && !hasModifier(key)
  const isDown = key.name === 'down' && !hasModifier(key)
  const isTab = key.name === 'tab' && !hasModifier(key)
  const isShiftTab =
    key.name === 'tab' && key.shift && !key.ctrl && !key.meta && !key.option
  const isEnter = isPlainEnterKey(key)
  const isPageUp = key.name === 'pageup' && !hasModifier(key)
  const isPageDown = key.name === 'pagedown' && !hasModifier(key)

  // Priority 0: Model picker overlay open - let it handle its own keyboard
  if (state.modelPickerOpen) {
    return { type: 'none' }
  }

  // Priority 0.5: Out of credits mode - Enter opens buy credits page
  if (state.inputMode === 'outOfCredits') {
    if (isEnter) {
      return { type: 'open-buy-credits' }
    }
    // Allow Escape or Ctrl+C to exit out-of-credits mode (return to normal input)
    if (isEscape || isCtrlC) {
      return { type: 'exit-input-mode' }
    }
    // Block most other inputs in this mode
    return { type: 'none' }
  }

  // Priority 1: Feedback mode - block global keys except Escape/Ctrl-C/Ctrl-V
  if (state.feedbackMode) {
    if (isEscape) {
      return { type: 'exit-feedback-mode' }
    }
    if (isCtrlC) {
      return state.inputValue.length === 0
        ? { type: 'exit-feedback-mode' }
        : { type: 'clear-feedback-input' }
    }
    if (isCtrlV) {
      return { type: 'paste' }
    }
    return { type: 'none' }
  }

  // Priority 2: Non-default input mode escape
  // Escape should exit the current mode BEFORE interrupting streams
  // Exception: modes with blockKeyboardExit cannot be escaped
  const modeConfig = getInputModeConfig(state.inputMode)
  // Priority 1.5: drive-mode Esc — pause (first press) / stop (second press).
  // Takes precedence over the generic interrupt so the operator's Esc always
  // routes to the drive-control surface while a drive is locked in. The
  // approval pane (awaiting_confirmation) is driveMode=false, so its Esc still
  // reaches the normal cancel/interrupt path — the pane never swallows Esc.
  if (isEscape && state.driveMode) {
    return { type: 'drive-interrupt' }
  }

  if (
    isEscape &&
    state.inputMode !== 'default' &&
    !modeConfig.blockKeyboardExit
  ) {
    return { type: 'exit-input-mode' }
  }

  // Priority 3: Clear input with ctrl-c when there's text
  if (isCtrlC && state.inputValue.trim().length > 0) {
    return { type: 'clear-input' }
  }

  // Priority 4: Interrupt streaming
  if (
    (isEscape || isCtrlC) &&
    (state.isStreaming || state.isWaitingForResponse)
  ) {
    return { type: 'interrupt-stream' }
  }

  // Priority 5: Backspace at position 0 exits non-default mode
  // Exception: modes with blockKeyboardExit cannot be exited via keyboard
  if (
    isBackspace &&
    state.cursorPosition === 0 &&
    state.inputMode !== 'default' &&
    !modeConfig.blockKeyboardExit &&
    state.inputValue.length === 0
  ) {
    return { type: 'backspace-exit-mode' }
  }

  // Priority 6: Slash menu navigation (when active and not disabled)
  // (extracted to keyboard-menu-actions.ts, FID-2026-0819-005 Loop 146;
  // null → fall through to the next priority, as before)
  const slashMenuAction = resolveSlashMenuAction(state, {
    isUp,
    isDown,
    isTab,
    isShiftTab,
    isEnter,
  })
  if (slashMenuAction) return slashMenuAction

  // Priority 7: Mention menu navigation (when active)
  // (extracted to keyboard-menu-actions.ts, FID-2026-0819-005 Loop 146;
  // null → fall through to the next priority, as before)
  const mentionMenuAction = resolveMentionMenuAction(state, {
    isUp,
    isDown,
    isTab,
    isShiftTab,
    isEnter,
  })
  if (mentionMenuAction) return mentionMenuAction

  // Priority 8: Tab to open file menu (when not in a menu, not shift-tab, and suggestions enabled)
  // This is handled by the hook since it needs to check word at cursor
  if (
    isTab &&
    !key.shift &&
    !state.mentionMenuActive &&
    !state.slashMenuActive &&
    !state.disableSlashSuggestions
  ) {
    return { type: 'open-file-menu-with-tab' }
  }

  // Priority 9: Queue management
  if (isCtrlC && state.queuePaused && state.queuedCount > 0) {
    return { type: 'clear-queue' }
  }

  // Priority 10: Bash history navigation (when in bash mode)
  if (state.inputMode === 'bash') {
    if (isUp && state.historyNavUpEnabled) {
      return { type: 'bash-history-up' }
    }
    if (isDown && state.historyNavDownEnabled) {
      return { type: 'bash-history-down' }
    }
  }

  // Priority 10.5: Regular history navigation (when at edges and enabled)
  if (isUp && state.historyNavUpEnabled) {
    return { type: 'history-up' }
  }
  if (isDown && state.historyNavDownEnabled) {
    return { type: 'history-down' }
  }

  // Priority 11: Toggle all collapsed/expanded (Ctrl+T)
  const isCtrlT = key.ctrl && key.name === 't' && !key.meta && !key.option

  if (isCtrlT) {
    return { type: 'toggle-all' }
  }

  // Priority 12: Agent mode toggle (tab or shift-tab when not in menus)
  if (
    (isShiftTab || isTab) &&
    !state.slashMenuActive &&
    !state.mentionMenuActive
  ) {
    return { type: 'toggle-agent-mode' }
  }

  // Priority 13: Unfocus agent
  if (isEscape && state.focusedAgentId !== null) {
    return { type: 'unfocus-agent' }
  }

  // Priority 14: Scroll with PageUp/PageDown
  if (isPageUp) {
    return { type: 'scroll-up' }
  }
  if (isPageDown) {
    return { type: 'scroll-down' }
  }

  // Priority 15: Paste (ctrl-v)
  if (isCtrlV) {
    return { type: 'paste' }
  }

  // Priority 16: Exit app (ctrl-c double-tap)
  if (isCtrlC) {
    if (state.nextCtrlCWillExit) {
      return { type: 'exit-app' }
    }
    return { type: 'exit-app-warning' }
  }

  return { type: 'none' }
}

/**
 * Creates default chat keyboard state for initialization.
 */
export function createDefaultChatKeyboardState(): ChatKeyboardState {
  return {
    inputMode: 'default',
    inputValue: '',
    cursorPosition: 0,
    isStreaming: false,
    isWaitingForResponse: false,
    feedbackMode: false,
    focusedAgentId: null,
    slashMenuActive: false,
    mentionMenuActive: false,
    slashSelectedIndex: 0,
    agentSelectedIndex: 0,
    slashMatchesLength: 0,
    totalMentionMatches: 0,
    disableSlashSuggestions: false,
    modelPickerOpen: false,
    queuePaused: false,
    queuedCount: 0,
    historyNavUpEnabled: false,
    historyNavDownEnabled: false,
    nextCtrlCWillExit: false,
    driveMode: false,
    drivePaused: false,
  }
}
