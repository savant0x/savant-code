/**
 * Feedback / publish / review overlay state, command-result routing, and
 * prompt submission for the chat screen (FID-2026-0805-003). Extracted from
 * chat.tsx verbatim; depends on the messaging hook's onSubmitPrompt.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useChatFollowupListener } from './use-chat-followup-listener'
import { usePublishMutation } from '../hooks/use-publish-mutation'
import { useChatHistoryStore } from '../state/chat-history-store'
import { useFeedbackStore } from '../state/feedback-store'
import { usePublishStore } from '../state/publish-store'
import { useReviewStore } from '../state/review-store'
import { reportActivity } from '../utils/activity-tracker'
import { showClipboardMessage } from '../utils/clipboard'
import { logger } from '../utils/logger'
import { setTerminalTitle } from '../utils/terminal-title'

import type {
  UseChatOverlaysArgs,
  UseChatOverlaysReturn,
} from './use-chat-overlays-types'
import type { CommandResult } from '../commands/command-registry'
import type { FeedbackCategory } from '@savant-code/common/constants/feedback'

export type {
  UseChatOverlaysArgs,
  UseChatOverlaysReturn,
} from './use-chat-overlays-types'

export function useChatOverlays({
  onSubmitPrompt,
  agentMode,
  inputValue,
  cursorPosition,
  inputRef,
  setInputValue,
  setInputFocused,
  setInputMode,
  resetHistoryNavigation,
  askUserState,
}: UseChatOverlaysArgs): UseChatOverlaysReturn {
  const {
    feedbackMode,
    feedbackText,
    openFeedbackForMessage,
    closeFeedback,
    saveCurrentInput,
    restoreSavedInput,
    setFeedbackText,
  } = useFeedbackStore(
    useShallow((state) => ({
      feedbackMode: state.feedbackMode,
      feedbackText: state.feedbackText,
      openFeedbackForMessage: state.openFeedbackForMessage,
      closeFeedback: state.closeFeedback,
      saveCurrentInput: state.saveCurrentInput,
      restoreSavedInput: state.restoreSavedInput,
      setFeedbackText: state.setFeedbackText,
    })),
  )

  const { publishMode, openPublishMode, closePublish, preSelectAgents } =
    usePublishStore(
      useShallow((state) => ({
        publishMode: state.publishMode,
        openPublishMode: state.openPublishMode,
        closePublish: state.closePublish,
        preSelectAgents: state.preSelectAgents,
      })),
    )

  const { reviewMode, closeReviewScreen } = useReviewStore(
    useShallow((state) => ({
      reviewMode: state.reviewMode,
      closeReviewScreen: state.closeReviewScreen,
    })),
  )

  const publishMutation = usePublishMutation()

  const handleCommandResult = useCallback(
    (result?: CommandResult) => {
      if (!result) return

      if (result.openFeedbackMode) {
        // Save the feedback text that was set by the command handler before opening feedback mode
        const { feedbackText, feedbackCursor } = useFeedbackStore.getState()
        saveCurrentInput('', 0)
        openFeedbackForMessage(null)
        // Restore the prefilled text after openFeedbackForMessage resets it
        if (feedbackText) {
          useFeedbackStore.getState().setFeedbackText(feedbackText)
          useFeedbackStore.getState().setFeedbackCursor(feedbackCursor)
        }
      }

      if (result.openPublishMode) {
        if (result.preSelectAgents && result.preSelectAgents.length > 0) {
          // preSelectAgents already sets publishMode: true, so don't call openPublishMode
          // which would reset the selectedAgentIds
          preSelectAgents(result.preSelectAgents)
        } else {
          openPublishMode()
        }
      }

      if (result.openChatHistory) {
        useChatHistoryStore.getState().openChatHistory()
      }

      if (result.openReviewScreen) {
        useReviewStore.getState().openReviewScreen()
      }
    },
    [
      saveCurrentInput,
      openFeedbackForMessage,
      openPublishMode,
      preSelectAgents,
    ],
  )

  const inputValueRef = useRef(inputValue)
  const cursorPositionRef = useRef(cursorPosition)
  useEffect(() => {
    inputValueRef.current = inputValue
  }, [inputValue])

  useEffect(() => {
    cursorPositionRef.current = cursorPosition
  }, [cursorPosition])

  const handleOpenFeedbackForMessage = useCallback(
    (
      id: string | null,
      options?: {
        category?: FeedbackCategory
        footerMessage?: string
        errors?: Array<{ id: string; message: string }>
      },
    ) => {
      saveCurrentInput(inputValueRef.current, cursorPositionRef.current)
      openFeedbackForMessage(id, options)
    },
    [saveCurrentInput, openFeedbackForMessage],
  )

  const handleMessageFeedback = useCallback(
    (
      id: string,
      options?: {
        category?: FeedbackCategory
        footerMessage?: string
        errors?: Array<{ id: string; message: string }>
      },
    ) => {
      handleOpenFeedbackForMessage(id, options)
    },
    [handleOpenFeedbackForMessage],
  )

  const handleExitFeedback = useCallback(() => {
    const { value, cursor } = restoreSavedInput()
    setInputValue({
      text: value,
      cursorPosition: cursor,
      lastEditDueToNav: false,
    })
    setInputFocused(true)
    resetHistoryNavigation()
  }, [
    restoreSavedInput,
    setInputValue,
    setInputFocused,
    resetHistoryNavigation,
  ])

  const handleCloseFeedback = useCallback(() => {
    closeFeedback()
    handleExitFeedback()
  }, [closeFeedback, handleExitFeedback])

  const handleExitPublish = useCallback(() => {
    closePublish()
    setInputFocused(true)
  }, [closePublish, setInputFocused])

  const handleReviewOptionSelect = useCallback(
    (reviewText: string) => {
      closeReviewScreen()
      setInputFocused(true)
      // Submit the review request
      onSubmitPrompt(reviewText, agentMode)
        .then((result) => handleCommandResult(result))
        .catch((error) => {
          logger.error({ error }, '[review] Failed to submit review prompt')
          showClipboardMessage('Failed to send review request', {
            durationMs: 3000,
          })
        })
    },
    [
      closeReviewScreen,
      setInputFocused,
      onSubmitPrompt,
      agentMode,
      handleCommandResult,
    ],
  )

  const handleCloseReviewScreen = useCallback(() => {
    closeReviewScreen()
    setInputFocused(true)
  }, [closeReviewScreen, setInputFocused])

  const handleReviewCustom = useCallback(() => {
    closeReviewScreen()
    setInputMode('review')
    setInputFocused(true)
  }, [closeReviewScreen, setInputMode, setInputFocused])

  const handlePublish = useCallback(
    async (agentIds: string[]) => {
      await publishMutation.mutateAsync(agentIds)
    },
    [publishMutation],
  )

  // Ensure bracketed paste events target the active chat input
  useEffect(() => {
    if (feedbackMode) {
      inputRef.current?.focus()
      return
    }
    if (!askUserState) {
      inputRef.current?.focus()
    }
  }, [feedbackMode, askUserState, inputRef])

  const handleSubmit = useCallback(async () => {
    // Report activity for ad rotation
    reportActivity()
    // Update terminal title with truncated user input
    if (inputValue.trim()) {
      setTerminalTitle(inputValue)
    }
    // FID-007 E1: surface submit failures instead of an unhandled rejection.
    try {
      const result = await onSubmitPrompt(inputValue, agentMode)
      handleCommandResult(result)
    } catch (error) {
      logger.error({ error }, '[submit] Failed to submit prompt')
      showClipboardMessage('Failed to send message', { durationMs: 3000 })
    }
  }, [onSubmitPrompt, inputValue, agentMode, handleCommandResult])

  useChatFollowupListener({ onSubmitPrompt, agentMode })

  return {
    feedbackMode,
    feedbackText,
    setFeedbackText,
    handleMessageFeedback,
    handleCloseFeedback,
    handleExitFeedback,
    handleExitPublish,
    handleReviewOptionSelect,
    handleCloseReviewScreen,
    handleReviewCustom,
    handlePublish,
    handleSubmit,
    handleCommandResult,
    reviewMode,
    publishMode,
  }
}
