import type { InputMode } from './input-modes'

/**
 * State needed to determine keyboard actions in chat input contexts.
 * This is a focused subset of app state relevant to keyboard handling.
 */
export type ChatKeyboardState = {
  // Input state
  inputMode: InputMode
  inputValue: string
  cursorPosition: number

  // Stream state
  isStreaming: boolean
  isWaitingForResponse: boolean

  // Feedback mode
  feedbackMode: boolean

  // Focus state
  focusedAgentId: string | null

  // Menu state
  slashMenuActive: boolean
  mentionMenuActive: boolean
  slashSelectedIndex: number
  agentSelectedIndex: number
  slashMatchesLength: number
  totalMentionMatches: number
  disableSlashSuggestions: boolean

  // Overlay state
  modelPickerOpen: boolean

  // Queue state
  queuePaused: boolean
  queuedCount: number

  // History navigation state
  historyNavUpEnabled: boolean
  historyNavDownEnabled: boolean

  // Exit handler state
  nextCtrlCWillExit: boolean

  // FID-2026-0818-007: drive-mode Esc pause/stop state.
  driveMode: boolean
  drivePaused: boolean
}

/**
 * All possible keyboard actions for chat input.
 * Each action represents a distinct behavior to be handled.
 */
export type ChatKeyboardAction =
  // Mode actions
  | { type: 'exit-input-mode' }
  | { type: 'exit-feedback-mode' }
  | { type: 'clear-feedback-input' }

  // Input actions
  | { type: 'clear-input' }
  | { type: 'backspace-exit-mode' }

  // Stream actions
  | { type: 'interrupt-stream' }

  // Drive actions (FID-2026-0818-007)
  | { type: 'drive-interrupt' }

  // Menu navigation
  | { type: 'slash-menu-down' }
  | { type: 'slash-menu-up' }
  | { type: 'slash-menu-select' }
  | { type: 'slash-menu-complete' }
  | { type: 'mention-menu-down' }
  | { type: 'mention-menu-up' }
  | { type: 'mention-menu-tab' }
  | { type: 'mention-menu-shift-tab' }
  | { type: 'mention-menu-select' }
  | { type: 'mention-menu-complete' }
  | { type: 'open-file-menu-with-tab' }

  // History navigation
  | { type: 'history-up' }
  | { type: 'history-down' }

  // Agent mode
  | { type: 'toggle-agent-mode' }
  | { type: 'unfocus-agent' }

  // Toggle all collapsed/expanded
  | { type: 'toggle-all' }

  // Queue actions
  | { type: 'clear-queue' }

  // Exit actions
  | { type: 'exit-app-warning' }
  | { type: 'exit-app' }

  // Bash history navigation
  | { type: 'bash-history-up' }
  | { type: 'bash-history-down' }

  // Scroll actions
  | { type: 'scroll-up' }
  | { type: 'scroll-down' }

  // Paste action (dispatcher checks clipboard content to route to image or text handler)
  | { type: 'paste' }

  // Out of credits action
  | { type: 'open-buy-credits' }

  // No action needed
  | { type: 'none' }
