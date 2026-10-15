import { markRunningAgentsAsCancelled } from '../../../utils/block-operations'
import { appendInterruptionNotice } from '../../../utils/message-block-helpers'
import { createBatchedMessageUpdater } from '../../../utils/message-updater'

import type { ChatMessage } from '../../../types/chat'
import type { SendMessageTimerController } from '../../../utils/send-message-timer'
import type { StreamController } from '../../stream-state'
import type { StreamStatus } from '../../use-message-queue'
import type { MutableRefObject } from 'react'

export const setupStreamingContext = (params: {
  aiMessageId: string
  timerController: SendMessageTimerController
  setMessages: (updater: (messages: ChatMessage[]) => ChatMessage[]) => void
  streamRefs: StreamController
  abortControllerRef: MutableRefObject<AbortController | null>
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  isQueuePausedRef?: MutableRefObject<boolean>
  isProcessingQueueRef?: MutableRefObject<boolean>
  updateChainInProgress: (value: boolean) => void
  setIsRetrying: (value: boolean) => void
  setStreamingAgents: (updater: (prev: Set<string>) => Set<string>) => void
}) => {
  const {
    timerController,
    setMessages,
    streamRefs,
    abortControllerRef,
    setStreamStatus,
    setCanProcessQueue,
    isQueuePausedRef,
    isProcessingQueueRef,
    updateChainInProgress,
    setIsRetrying,
    setStreamingAgents,
  } = params
  const { aiMessageId } = params
  streamRefs.reset()
  timerController.start(aiMessageId)
  const updater = createBatchedMessageUpdater(aiMessageId, setMessages)
  // Clear any previous UI-only error on this message when starting a new run
  updater.clearUserError()
  const hasReceivedContentRef = { current: false }
  const abortController = new AbortController()
  abortControllerRef.current = abortController
  abortController.signal.addEventListener('abort', () => {
    // Abort means the user stopped streaming; update UI with an interruption notice.
    // Release the chain lock immediately so new messages can be sent directly instead
    // of being queued. The minor trade-off is that if the user sends a new message
    // before client.run() resolves, it may use stale previousRunStateRef. This is
    // acceptable because: (1) the user explicitly cancelled, and (2) client.run()
    // will update previousRunStateRef when it eventually resolves, so subsequent
    // runs will have the full state.
    streamRefs.setters.setWasAbortedByUser(true)
    setIsRetrying(false)
    timerController.stop('aborted')
    // Update stream status so the UI reflects cancellation visually
    setStreamStatus('idle')
    // Clear streaming agents so cancelled status displays correctly in UI
    setStreamingAgents(() => new Set())
    // Release chain lock and queue state so new messages are sent directly
    updateChainInProgress(false)
    setCanProcessQueue(!isQueuePausedRef?.current)
    if (isProcessingQueueRef) {
      isProcessingQueueRef.current = false
    }
    updater.updateAiMessageBlocks((blocks) => {
      const cancelledBlocks = markRunningAgentsAsCancelled(blocks)
      return appendInterruptionNotice(cancelledBlocks)
    })
    updater.markComplete()
  })
  return { updater, hasReceivedContentRef, abortController }
}
