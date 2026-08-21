import { getInputModeConfig } from '../utils/input-modes'
import { createDefaultChatKeyboardState } from '../utils/keyboard-actions'

import type { InputMode } from '../utils/input-modes'
import type { ChatKeyboardState } from '../utils/keyboard-actions'

export type ChatKeyboardStateDeps = {
  inputMode: InputMode
  inputValue: string
  feedbackMode: boolean
  feedbackText: string
  cursorPosition: number
  isStreaming: boolean
  isWaitingForResponse: boolean
  focusedAgentId: string | null
  slashMenuActive: boolean
  mentionMenuActive: boolean
  slashSelectedIndex: number
  agentSelectedIndex: number
  slashMatchesLength: number
  totalMentionMatches: number
  modelPickerOpen: boolean
  historyNavUpEnabled: boolean
  historyNavDownEnabled: boolean
  nextCtrlCWillExit: boolean
  queuePaused: boolean
  queuedCount: number
  driveMode: boolean
  drivePaused: boolean
}

export function buildChatKeyboardState(
  deps: ChatKeyboardStateDeps,
): ChatKeyboardState {
  return {
    ...createDefaultChatKeyboardState(),
    inputMode: deps.inputMode,
    inputValue: deps.feedbackMode ? deps.feedbackText : deps.inputValue,
    cursorPosition: deps.cursorPosition,
    isStreaming: deps.isStreaming,
    isWaitingForResponse: deps.isWaitingForResponse,
    feedbackMode: deps.feedbackMode,
    focusedAgentId: deps.focusedAgentId,
    slashMenuActive: deps.slashMenuActive,
    mentionMenuActive: deps.mentionMenuActive,
    slashSelectedIndex: deps.slashSelectedIndex,
    agentSelectedIndex: deps.agentSelectedIndex,
    slashMatchesLength: deps.slashMatchesLength,
    totalMentionMatches: deps.totalMentionMatches,
    disableSlashSuggestions: getInputModeConfig(deps.inputMode)
      .disableSlashSuggestions,
    modelPickerOpen: deps.modelPickerOpen,
    historyNavUpEnabled: deps.historyNavUpEnabled,
    historyNavDownEnabled: deps.historyNavDownEnabled,
    nextCtrlCWillExit: deps.nextCtrlCWillExit,
    queuePaused: deps.queuePaused,
    queuedCount: deps.queuedCount,
    driveMode: deps.driveMode,
    drivePaused: deps.drivePaused,
  }
}
