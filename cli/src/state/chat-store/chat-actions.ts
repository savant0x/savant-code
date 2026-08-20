import { castDraft } from 'immer'

import { AGENT_MODES, IS_SAVANT_FREE } from '../../utils/constants'
import { clamp } from '../../utils/math'
import { saveModePreference } from '../../utils/settings'

import type { ChatCoreActions, ChatStoreSet } from './types'

type SetState = ChatStoreSet

/**
 * Core chat actions for the zustand store (messages, input, mode, attachments,
 * ask-user, followups). Extracted from chat-store.ts (FID-2026-0805-003); the
 * immer-wrapped `set` is injected so the action bodies stay verbatim.
 */
export const createChatActions = (set: SetState): ChatCoreActions => ({
  setMessages: (value) =>
    set((state) => {
      state.messages =
        typeof value === 'function' ? value(state.messages) : value
    }),

  setStreamingAgents: (value) =>
    set((state) => {
      state.streamingAgents =
        typeof value === 'function' ? value(state.streamingAgents) : value
    }),

  setFocusedAgentId: (value) =>
    set((state) => {
      state.focusedAgentId =
        typeof value === 'function' ? value(state.focusedAgentId) : value
    }),

  setInputValue: (value) =>
    set((state) => {
      const { text, cursorPosition, lastEditDueToNav } =
        typeof value === 'function'
          ? value({
              text: state.inputValue,
              cursorPosition: state.cursorPosition,
              lastEditDueToNav: state.lastEditDueToNav,
            })
          : value
      state.inputValue = text
      state.cursorPosition = clamp(cursorPosition, 0, text.length)
      state.lastEditDueToNav = lastEditDueToNav
    }),

  setInputFocused: (focused) =>
    set((state) => {
      state.inputFocused = focused
    }),

  setIsFocusSupported: (supported) =>
    set((state) => {
      state.isFocusSupported = supported
    }),

  setActiveSubagents: (value) =>
    set((state) => {
      state.activeSubagents =
        typeof value === 'function' ? value(state.activeSubagents) : value
    }),

  setIsChainInProgress: (active) =>
    set((state) => {
      state.isChainInProgress = active
    }),

  setSlashSelectedIndex: (value) =>
    set((state) => {
      state.slashSelectedIndex =
        typeof value === 'function' ? value(state.slashSelectedIndex) : value
    }),

  setAgentSelectedIndex: (value) =>
    set((state) => {
      state.agentSelectedIndex =
        typeof value === 'function' ? value(state.agentSelectedIndex) : value
    }),

  setAgentMode: (mode) =>
    set((state) => {
      if (IS_SAVANT_FREE) return
      state.agentMode = mode
      saveModePreference(mode)
    }),

  toggleAgentMode: () =>
    set((state) => {
      if (IS_SAVANT_FREE) return
      const currentIndex = AGENT_MODES.indexOf(state.agentMode)
      const nextIndex = (currentIndex + 1) % AGENT_MODES.length
      state.agentMode = AGENT_MODES[nextIndex]
      saveModePreference(state.agentMode)
    }),

  setHasReceivedPlanResponse: (value) =>
    set((state) => {
      state.hasReceivedPlanResponse = value
    }),

  setLastMessageMode: (mode) =>
    set((state) => {
      state.lastMessageMode = mode
    }),

  addSessionCredits: (credits) =>
    set((state) => {
      state.sessionCreditsUsed += credits
    }),

  setRunState: (runState) =>
    set((state) => {
      state.runState = runState ? castDraft(runState) : null
    }),

  setActiveTopBanner: (banner) =>
    set((state) => {
      state.activeTopBanner = banner
    }),

  closeTopBanner: () =>
    set((state) => {
      state.activeTopBanner = null
    }),

  setInputMode: (mode) =>
    set((state) => {
      state.inputMode = mode
    }),

  setAdsEnabled: (enabled) =>
    set((state) => {
      state.adsEnabled = enabled
    }),

  setIsRetrying: (retrying) =>
    set((state) => {
      state.isRetrying = retrying
    }),

  setAskUserState: (askUserState) =>
    set((state) => {
      state.askUserState = askUserState
    }),

  addPendingAttachment: (attachment) =>
    set((state) => {
      // Don't add duplicates — use path for image/file, id for text
      const id = attachment.kind === 'text' ? attachment.id : attachment.path
      const isDuplicate = state.pendingAttachments.some((a) =>
        a.kind === 'text' ? a.id === id : a.path === id,
      )
      if (!isDuplicate) {
        state.pendingAttachments.push(attachment)
      }
    }),

  removePendingAttachment: (id) =>
    set((state) => {
      state.pendingAttachments = state.pendingAttachments.filter((a) =>
        a.kind === 'text' ? a.id !== id : a.path !== id,
      )
    }),

  clearPendingAttachments: () =>
    set((state) => {
      state.pendingAttachments = []
    }),

  updateAskUserAnswer: (questionIndex, optionIndex) =>
    set((state) => {
      if (!state.askUserState) return

      const question = state.askUserState.questions[questionIndex]
      const currentAnswer = state.askUserState.selectedAnswers[questionIndex]

      if (question?.multiSelect) {
        // Multi-select: toggle option in array
        const selected = Array.isArray(currentAnswer) ? currentAnswer : []
        const newSelected = selected.includes(optionIndex)
          ? selected.filter((i) => i !== optionIndex) // Remove if already selected
          : [...selected, optionIndex] // Add if not selected

        state.askUserState.selectedAnswers[questionIndex] = newSelected
      } else {
        // Single-select: set option index
        state.askUserState.selectedAnswers[questionIndex] = optionIndex
      }

      // Clear other text when any option is selected (mutually exclusive)
      state.askUserState.otherTexts[questionIndex] = ''
    }),

  updateAskUserOtherText: (questionIndex, text) =>
    set((state) => {
      if (!state.askUserState) return

      state.askUserState.otherTexts[questionIndex] = text

      // Clear selected option(s) when text is entered (mutually exclusive)
      if (text) {
        const question = state.askUserState.questions[questionIndex]
        if (question?.multiSelect) {
          state.askUserState.selectedAnswers[questionIndex] = []
        } else {
          state.askUserState.selectedAnswers[questionIndex] = -1
        }
      }
    }),

  addPendingBashMessage: (message) =>
    set((state) => {
      state.pendingBashMessages.push(message)
    }),

  updatePendingBashMessage: (id, updates) =>
    set((state) => {
      const msg = state.pendingBashMessages.find((m) => m.id === id)
      if (msg) {
        Object.assign(msg, updates)
      }
    }),

  removePendingBashMessage: (id) =>
    set((state) => {
      state.pendingBashMessages = state.pendingBashMessages.filter(
        (m) => m.id !== id,
      )
    }),

  clearPendingBashMessages: () =>
    set((state) => {
      state.pendingBashMessages = []
    }),

  setSuggestedFollowups: (suggestedFollowups) =>
    set((state) => {
      state.suggestedFollowups = suggestedFollowups
    }),

  markFollowupClicked: (toolCallId: string, index: number) =>
    set((state) => {
      // Store in the persistent map
      if (!state.clickedFollowupsMap.has(toolCallId)) {
        state.clickedFollowupsMap.set(toolCallId, new Set<number>())
      }
      state.clickedFollowupsMap.get(toolCallId)!.add(index)

      // Also update the current suggestedFollowups if it matches
      if (state.suggestedFollowups?.toolCallId === toolCallId) {
        state.suggestedFollowups.clickedIndices.add(index)
      }
    }),

  setDriveMode: (active) =>
    set((state) => {
      state.driveMode = active
    }),

  setDriveState: (driveState) =>
    set((state) => {
      state.driveState = driveState
    }),

  setActiveAutoRunId: (id) =>
    set((state) => {
      state.activeAutoRunId = id
    }),

  setDrivePlanDraft: (draft) =>
    set((state) => {
      state.drivePlanDraft = draft
    }),

  setDrivePaused: (paused) =>
    set((state) => {
      state.drivePaused = paused
    }),
})
