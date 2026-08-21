import { getSelectedSlashCommand } from './slash-selection'
import { buildDriveControlMessage } from '../commands/auto-drive'
import { areCreditsRestored } from '../components/out-of-credits-banner'
import { WEBSITE_URL } from '../login/constants'
import { getProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { useFeedbackStore } from '../state/feedback-store'
import { showClipboardMessage } from '../utils/clipboard'
import { readClipboardImage } from '../utils/clipboard-image'
import { logger } from '../utils/logger'
import { safeOpen } from '../utils/open-url'
import {
  addClipboardPlaceholder,
  addPendingFileFromPath,
  addPendingImageFromFile,
  validateAndAddImage,
} from '../utils/pending-attachments'

import type { CommandResult } from '../commands/command-registry'
import type { MultilineInputHandle } from '../components/multiline-input'
import type { TriggerContext } from '../hooks/suggestion-engine/parsers'
import type { ChatKeyboardHandlers } from '../hooks/use-chat-keyboard'
import type { MatchedSlashCommand } from '../hooks/use-suggestion-engine'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { InputValue } from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { InputMode } from '../utils/input-modes'

export { buildChatKeyboardState } from './keyboard-state'
export type { ChatKeyboardStateDeps } from './keyboard-state'

export type ChatKeyboardHandlersDeps = {
  setInputMode: (mode: InputMode) => void
  handleCloseFeedback: () => void
  setFeedbackText: (text: string) => void
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  abortControllerRef: { current: AbortController | null }
  queuedMessagesLength: number
  pauseQueue: () => void
  setSlashSelectedIndex: (value: number | ((prev: number) => number)) => void
  slashMatches: MatchedSlashCommand[]
  slashSelectedIndex: number
  slashContext: TriggerContext
  inputValue: string
  applySlashInsertText: (selected: MatchedSlashCommand) => boolean
  onSubmitPrompt: (
    content: string,
    mode: AgentMode,
    options?: { preserveInputValue?: boolean },
  ) => Promise<CommandResult | undefined>
  agentMode: AgentMode
  handleCommandResult: (result?: CommandResult) => void
  setAgentSelectedIndex: (value: number | ((prev: number) => number)) => void
  agentSelectedIndex: number
  selectMentionAt: (index: number) => boolean
  openFileMenuWithTab: () => boolean
  navigateUp: () => void
  navigateDown: () => void
  toggleAgentMode: () => void
  setFocusedAgentId: (id: string | null) => void
  setInputFocused: (focused: boolean) => void
  inputRef: { current: MultilineInputHandle | null }
  handleCtrlC: () => void
  clearQueue: () => void
  scrollUp: () => void
  scrollDown: () => void
  handleToggleAll: () => void
  totalMentionMatches: number
  executeSlashCommand: (
    selected: MatchedSlashCommand | undefined,
  ) => Promise<void>
  sendMessage: SendMessageFn
}

/**
 * Builds the keyboard handlers object for the chat screen
 * (FID-2026-0805-003). Extracted from chat.tsx verbatim; module-level utils
 * are imported here, component-scope values come via `deps`.
 */
export function buildChatKeyboardHandlers(
  deps: ChatKeyboardHandlersDeps,
): ChatKeyboardHandlers {
  const {
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
  } = deps

  return {
    onExitInputMode: () => setInputMode('default'),
    onExitFeedbackMode: handleCloseFeedback,
    onClearFeedbackInput: () => {
      setFeedbackText('')
      useFeedbackStore.getState().setFeedbackCursor(0)
    },
    onClearInput: () =>
      setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false }),
    onBackspaceExitMode: () => setInputMode('default'),
    onInterruptStream: () => {
      abortControllerRef.current?.abort()
      if (queuedMessagesLength > 0) {
        pauseQueue()
      }
    },
    onDriveInterrupt: () => {
      // FID-2026-0818-007: drive-mode Esc — pause (first press) / stop
      // (second press). Aborts the current turn, then routes the control
      // through the same `<drive-control>` directive the /auto-drive subcommands use,
      // so the runtime records the pause/stop on the durable drive record.
      abortControllerRef.current?.abort()
      const store = useChatStore.getState()
      const action = store.drivePaused ? 'stop' : 'pause'
      store.setDrivePaused(action === 'pause')
      if (action === 'stop') {
        store.setDriveMode(false)
        store.setDriveState('blocked')
      }
      void sendMessage({
        content: buildDriveControlMessage(action, 'operator Esc'),
        agentMode: 'STRICT',
      }).catch(() => {
        // Fail closed: a dropped control send must not wedge the drive latch.
        store.setDrivePaused(false)
      })
    },
    onSlashMenuDown: () => setSlashSelectedIndex((prev) => prev + 1),
    onSlashMenuUp: () => setSlashSelectedIndex((prev) => prev - 1),
    onSlashMenuSelect: async () => {
      const selected = getSelectedSlashCommand(slashMatches, slashSelectedIndex)
      if (!selected) return
      await executeSlashCommand(selected)
    },
    onSlashMenuComplete: () => {
      // Complete the word without executing - same as clicking on the item
      const selected = getSelectedSlashCommand(slashMatches, slashSelectedIndex)
      if (!selected || slashContext.startIndex < 0) return

      // If the command has insertText, insert it instead of the command
      if (applySlashInsertText(selected)) return

      const before = inputValue.slice(0, slashContext.startIndex)
      const after = inputValue.slice(
        slashContext.startIndex + 1 + slashContext.query.length,
      )
      const replacement = `/${selected.id} `
      setInputValue({
        text: before + replacement + after,
        cursorPosition: before.length + replacement.length,
        lastEditDueToNav: false,
      })
      setSlashSelectedIndex(0)
    },
    onMentionMenuDown: () => setAgentSelectedIndex((prev) => prev + 1),
    onMentionMenuUp: () => setAgentSelectedIndex((prev) => prev - 1),
    onMentionMenuTab: () => {
      setAgentSelectedIndex((prev) => (prev + 1) % totalMentionMatches)
    },
    onMentionMenuShiftTab: () => {
      setAgentSelectedIndex(
        (prev) => (totalMentionMatches + prev - 1) % totalMentionMatches,
      )
    },
    onMentionMenuSelect: () => {
      // Try current selection, fall back to first item
      selectMentionAt(agentSelectedIndex) || selectMentionAt(0)
    },
    onMentionMenuComplete: () => {
      // Complete the word without executing - same as select for mentions
      selectMentionAt(agentSelectedIndex) || selectMentionAt(0)
    },
    onOpenFileMenuWithTab: () => openFileMenuWithTab(),
    onHistoryUp: navigateUp,
    onHistoryDown: navigateDown,
    onToggleAgentMode: toggleAgentMode,
    onUnfocusAgent: () => {
      setFocusedAgentId(null)
      setInputFocused(true)
      inputRef.current?.focus()
    },
    onClearQueue: clearQueue,
    onExitAppWarning: () => handleCtrlC(),
    onExitApp: () => handleCtrlC(),
    onBashHistoryUp: navigateUp,
    onBashHistoryDown: navigateDown,
    onPasteImage: () => {
      const placeholderPath = addClipboardPlaceholder()

      // Process the image in the background
      setTimeout(() => {
        const result = readClipboardImage()
        if (!result.success || !result.imagePath) {
          useChatStore.getState().removePendingImage(placeholderPath)
          showClipboardMessage(result.error || 'Failed to paste image', {
            durationMs: 3000,
          })
          return
        }

        const cwd = getProjectRoot() ?? process.cwd()
        addPendingImageFromFile(result.imagePath, cwd, placeholderPath).catch(
          (error) => {
            logger.error({ error }, 'Failed to add pending image from file')
            showClipboardMessage('Failed to add image', { durationMs: 3000 })
          },
        )
      }, 0)
    },
    onPasteImagePath: (imagePath: string) => {
      const cwd = getProjectRoot() ?? process.cwd()
      validateAndAddImage(imagePath, cwd).catch((error) => {
        logger.error({ error, imagePath }, 'Failed to validate and add image')
        showClipboardMessage('Failed to add image', { durationMs: 3000 })
      })
    },
    onPasteFilePath: (filePath: string, isDirectory: boolean) => {
      addPendingFileFromPath(filePath, isDirectory)
    },
    onPasteText: (text: string) => {
      setInputValue((prev) => {
        const before = prev.text.slice(0, prev.cursorPosition)
        const after = prev.text.slice(prev.cursorPosition)
        return {
          text: before + text + after,
          cursorPosition: before.length + text.length,
          lastEditDueToNav: false,
        }
      })
    },
    onScrollUp: scrollUp,
    onScrollDown: scrollDown,
    onToggleAll: handleToggleAll,
    onOpenBuyCredits: () => {
      // If credits have been restored, just return to default mode
      if (areCreditsRestored()) {
        setInputMode('default')
        return
      }
      // Otherwise open the buy credits page
      safeOpen(WEBSITE_URL + '/usage')
    },
  }
}
