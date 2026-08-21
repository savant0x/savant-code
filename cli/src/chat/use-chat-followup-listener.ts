import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { useEffect } from 'react'

import { useChatStore } from '../state/chat-store'
import { trackEvent } from '../utils/analytics'
import { showClipboardMessage } from '../utils/clipboard'
import { logger } from '../utils/logger'

import type { OnSubmitPrompt } from './types'
import type { AgentMode } from '../utils/constants'

export function useChatFollowupListener({
  onSubmitPrompt,
  agentMode,
}: {
  onSubmitPrompt: OnSubmitPrompt
  agentMode: AgentMode
}): void {
  useEffect(() => {
    const handleFollowupClick = (event: Event) => {
      const customEvent = event as CustomEvent<{
        prompt: string
        index: number
        toolCallId: string
      }>
      const { prompt, index, toolCallId } = customEvent.detail

      logger.info(
        { promptLength: prompt.length, index, toolCallId, agentMode },
        '[followup-click] Followup clicked',
      )

      trackEvent(AnalyticsEvent.FOLLOWUP_CLICKED, {
        promptLength: prompt.length,
        index,
        agentMode,
      })

      useChatStore.getState().markFollowupClicked(toolCallId, index)

      onSubmitPrompt(prompt, agentMode, {
        preserveInputValue: true,
      })
        .then((result) => {
          logger.info(
            { hasResult: !!result },
            '[followup-click] onSubmitPrompt completed',
          )
        })
        .catch((error) => {
          logger.error(
            { error },
            '[followup-click] onSubmitPrompt failed with error',
          )
          showClipboardMessage('Failed to send followup', { durationMs: 3000 })
        })
    }

    globalThis.addEventListener(
      'savant-code:send-followup',
      handleFollowupClick,
    )
    return () => {
      globalThis.removeEventListener(
        'savant-code:send-followup',
        handleFollowupClick,
      )
    }
  }, [onSubmitPrompt, agentMode])
}
