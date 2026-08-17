/**
 * Derived display values for the chat screen (FID-2026-0805-003). Extracted
 * from chat.tsx verbatim: suggestion-menu booleans, onboarding prompts, input
 * layout metrics, status indicator, input-box title, mouse activity, and the
 * sidebar width/directory display.
 */

import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { DEFAULT_SUGGESTED_PROMPTS } from '../components/suggested-prompts'
import { getProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { reportActivity } from '../utils/activity-tracker'
import { trackEvent } from '../utils/analytics'
import { IS_SAVANT_FREE } from '../utils/constants'
import { getInputModeConfig } from '../utils/input-modes'
import { formatCwd } from '../utils/path-helpers'
import { getStatusIndicatorState } from '../utils/status-indicator-state'
import { computeInputLayoutMetrics } from '../utils/text-layout'

import type { SuggestionItem } from '../components/suggestion-menu'
import type { StreamStatus } from '../hooks/use-message-queue'
import type { TriggerContext } from '../hooks/use-suggestion-engine'
import type { ChatMessage } from '../types/chat'
import type { SavantFreeSession } from '../types/savant-free-session'
import type { AskUserState } from '../types/store'
import type { InputMode } from '../utils/input-modes'
import type {
  AuthStatus,
  StatusIndicatorState,
} from '../utils/status-indicator-state'

export interface UseChatDerivedArgs {
  inputValue: string
  cursorPosition: number
  inputMode: InputMode
  messages: ChatMessage[]
  isStreaming: boolean
  isWaitingForResponse: boolean
  feedbackMode: boolean
  publishMode: boolean
  reviewMode: boolean
  askUserState: AskUserState | null
  showSuggestedPrompts: boolean
  slashContext: TriggerContext
  mentionContext: TriggerContext
  slashSuggestionItems: SuggestionItem[]
  agentSuggestionItems: SuggestionItem[]
  fileSuggestionItems: SuggestionItem[]
  statusMessage: string | null
  streamStatus: StreamStatus
  nextCtrlCWillExit: boolean
  isConnected: boolean
  authStatus: AuthStatus
  showReconnectionMessage: boolean
  isRetrying: boolean
  queuePreviewTitle: string | undefined
  pausedQueueText: string | undefined
  shouldShowQueuePreview: boolean
  isAtBottom: boolean
  savantFreeSession: SavantFreeSession | null
  subscriptionData?: {
    hasSubscription?: boolean
    rateLimit?: { limited?: boolean } | null
    fallbackToALaCarte?: boolean
  }
  inputWidth: number
  terminalHeight: number
  terminalWidth: number
  isCompactHeight: boolean
  isNarrowWidth: boolean
}

export interface UseChatDerivedReturn {
  hasSlashSuggestions: boolean
  hasMentionSuggestions: boolean
  hasSuggestionMenu: boolean
  showOnboardingPrompts: boolean
  shouldCenterInputVertically: boolean
  statusIndicatorState: StatusIndicatorState
  inputBoxTitle: string | undefined
  isSavantFreeSessionOver: boolean
  shouldShowStatusLine: boolean
  handleMouseActivity: () => void
  directoryDisplay: string
}

export function useChatDerived({
  inputValue,
  cursorPosition,
  inputMode,
  messages,
  isStreaming,
  isWaitingForResponse,
  feedbackMode,
  publishMode,
  reviewMode,
  askUserState,
  showSuggestedPrompts,
  slashContext,
  mentionContext,
  slashSuggestionItems,
  agentSuggestionItems,
  fileSuggestionItems,
  statusMessage,
  streamStatus,
  nextCtrlCWillExit,
  isConnected,
  authStatus,
  showReconnectionMessage,
  isRetrying,
  queuePreviewTitle,
  pausedQueueText,
  shouldShowQueuePreview,
  isAtBottom,
  savantFreeSession,
  subscriptionData,
  inputWidth,
  terminalHeight,
  terminalWidth,
  isCompactHeight,
  isNarrowWidth,
}: UseChatDerivedArgs): UseChatDerivedReturn {
  const modeConfig = getInputModeConfig(inputMode)
  const hasSlashSuggestions =
    slashContext.active &&
    slashSuggestionItems.length > 0 &&
    !modeConfig.disableSlashSuggestions
  const hasMentionSuggestions =
    !slashContext.active &&
    mentionContext.active &&
    (agentSuggestionItems.length > 0 || fileSuggestionItems.length > 0)
  const hasSuggestionMenu = hasSlashSuggestions || hasMentionSuggestions

  // Show first-time onboarding starter prompts only on a pristine, idle,
  // empty-input default-mode chat — and never while a menu/overlay is up.
  const showOnboardingPrompts =
    showSuggestedPrompts &&
    messages.length === 0 &&
    inputValue.length === 0 &&
    inputMode === 'default' &&
    !hasSuggestionMenu &&
    !isStreaming &&
    !isWaitingForResponse &&
    !feedbackMode &&
    !publishMode &&
    !reviewMode &&
    askUserState === null

  // Fire a one-time impression so we can measure onboarding-prompt usage
  // (click-through = SUGGESTED_PROMPT_CLICKED / SUGGESTED_PROMPT_SHOWN).
  const suggestedPromptsShownRef = useRef(false)
  useEffect(() => {
    if (showOnboardingPrompts && !suggestedPromptsShownRef.current) {
      suggestedPromptsShownRef.current = true
      trackEvent(AnalyticsEvent.SUGGESTED_PROMPT_SHOWN, {
        count: isCompactHeight
          ? Math.min(2, DEFAULT_SUGGESTED_PROMPTS.length)
          : DEFAULT_SUGGESTED_PROMPTS.length,
        isCompactHeight,
      })
    }
  }, [showOnboardingPrompts, isCompactHeight])

  const inputLayoutMetrics = useMemo(() => {
    // In bash mode, layout is based on the actual input (no ! prefix needed)
    const text = inputValue ?? ''
    const layoutContent = text.length > 0 ? text : ' '
    const safeCursor = Math.max(
      0,
      Math.min(cursorPosition, layoutContent.length),
    )
    const cursorProbe =
      safeCursor >= layoutContent.length
        ? layoutContent
        : layoutContent.slice(0, safeCursor)
    const cols = Math.max(1, inputWidth)
    return computeInputLayoutMetrics({
      layoutContent,
      cursorProbe,
      cols,
      maxHeight: Math.floor(terminalHeight / 2),
    })
  }, [inputValue, cursorPosition, inputWidth, terminalHeight])
  const isMultilineInput = inputLayoutMetrics.heightLines > 1
  const shouldCenterInputVertically = !hasSuggestionMenu && !isMultilineInput
  const statusIndicatorState = getStatusIndicatorState({
    statusMessage,
    streamStatus,
    nextCtrlCWillExit,
    isConnected,
    authStatus,
    showReconnectionMessage,
    isRetrying,
    isAskUserActive: askUserState !== null,
  })
  const hasStatusIndicatorContent = statusIndicatorState.kind !== 'idle'

  // Auto-show subscription limit banner when rate limit becomes active
  const subscriptionLimitShownRef = useRef(false)
  const subscriptionRateLimit = subscriptionData?.hasSubscription
    ? subscriptionData.rateLimit
    : undefined
  const fallbackToALaCarte = subscriptionData?.fallbackToALaCarte ?? false
  useEffect(() => {
    const isLimited = subscriptionRateLimit?.limited === true
    if (isLimited && !subscriptionLimitShownRef.current) {
      subscriptionLimitShownRef.current = true
      // Skip showing the banner if user prefers to always fall back to a-la-carte
      if (!fallbackToALaCarte) {
        useChatStore.getState().setInputMode('subscriptionLimit')
      }
    } else if (!isLimited) {
      subscriptionLimitShownRef.current = false
      if (useChatStore.getState().inputMode === 'subscriptionLimit') {
        useChatStore.getState().setInputMode('default')
      }
    }
  }, [subscriptionRateLimit?.limited, fallbackToALaCarte])

  const inputBoxTitle = useMemo(() => {
    const segments: string[] = []

    if (queuePreviewTitle) {
      segments.push(queuePreviewTitle)
    } else if (pausedQueueText) {
      segments.push(`⏸ ${pausedQueueText}`)
    }

    if (segments.length === 0) {
      return undefined
    }

    return ` ${segments.join('   ')} `
  }, [queuePreviewTitle, pausedQueueText])

  const hasActiveSavantFreeSession =
    IS_SAVANT_FREE && savantFreeSession?.status === 'active'
  const isSavantFreeSessionOver =
    IS_SAVANT_FREE && savantFreeSession?.status === 'ended'
  const shouldShowStatusLine =
    !feedbackMode &&
    (hasStatusIndicatorContent ||
      shouldShowQueuePreview ||
      !isAtBottom ||
      hasActiveSavantFreeSession)

  // Track mouse movement for ad activity (throttled)
  const lastMouseActivityRef = useRef<number>(0)
  const handleMouseActivity = useCallback(() => {
    const now = Date.now()
    // Throttle to max once per second
    if (now - lastMouseActivityRef.current > 1000) {
      lastMouseActivityRef.current = now
      reportActivity()
    }
  }, [])

  // FID-2026-0816-007 step 1: the sidebar is now breakpoint-driven (icon rail
  // below 60 cols, full surface above) via useTerminalBreakpoints in
  // ChatSidebar, so there is no longer a hide threshold here. The cwd display
  // folds into input-bar chrome (step 5); until then it truncates to the
  // chat-column width.
  const projectRootDisplay = formatCwd(getProjectRoot())
  const directoryMaxWidth = terminalWidth - 2
  const directoryDisplay =
    projectRootDisplay.length > directoryMaxWidth && directoryMaxWidth > 10
      ? `…${projectRootDisplay.slice(-directoryMaxWidth + 1)}`
      : projectRootDisplay

  return {
    hasSlashSuggestions,
    hasMentionSuggestions,
    hasSuggestionMenu,
    showOnboardingPrompts,
    shouldCenterInputVertically,
    statusIndicatorState,
    inputBoxTitle,
    isSavantFreeSessionOver,
    shouldShowStatusLine,
    handleMouseActivity,
    directoryDisplay,
  }
}
