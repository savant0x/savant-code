import type { StreamController } from './stream-state'
import type { ElapsedTimeTracker } from './use-elapsed-time'
import type { StreamStatus } from './use-message-queue'
import type { MultilineInputHandle } from '../components/multiline-input'
import type { ChatMessage } from '../types/chat'
import type { PendingAttachment } from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { StalledResetWatcher } from '../utils/finish-logic'
import type { SendMessageTimerEvent } from '../utils/send-message-timer'
import type { MessageContent, RunState } from '@savant-code/sdk'
import type { MutableRefObject } from 'react'

/** Options for useSendMessage. Split out of use-send-message.ts (FID-2026-0805-003).
 *
 * FID-2026-1013-012 W3-3: `inputRef` carries the real input handle
 * (`MultilineInputHandle | null`, the same type every other chat surface
 * uses) instead of `any`; the two consumers only call `focus`/
 * `getValue`-style members the handle already declares.
 */
export interface UseSendMessageOptions {
  inputRef: MutableRefObject<MultilineInputHandle | null>
  activeSubagentsRef: React.MutableRefObject<Set<string>>
  isChainInProgressRef: React.MutableRefObject<boolean>
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  abortControllerRef: React.MutableRefObject<AbortController | null>
  agentId?: string
  onBeforeMessageSend: () => Promise<{
    success: boolean
    errors: Array<{ id: string; message: string }>
  }>
  mainAgentTimer: ElapsedTimeTracker
  scrollToLatest: () => void
  onTimerEvent?: (event: SendMessageTimerEvent) => void
  isQueuePausedRef?: React.MutableRefObject<boolean>
  isProcessingQueueRef?: React.MutableRefObject<boolean>
  resumeQueue?: () => void
  /** Put a message back at the head of the queue. Used by the savant-free
   *  run-start guard so a message that can't be sent (session fully over)
   *  is held for the next session instead of consumed. */
  requeueMessageAtFront?: (message: {
    content: string
    attachments: PendingAttachment[]
  }) => void
  continueChat: boolean
  continueChatId?: string
}

/**
 * Hook-scoped state for the sendMessage body factory (createSendMessageBody).
 * Kept here so both the hook and the factory stay under the line bar
 * (FID-2026-0805-003).
 */
export type CreateSendMessageBodyParams = {
  inputRef: MutableRefObject<MultilineInputHandle | null>
  isChainInProgressRef: MutableRefObject<boolean>
  setStreamStatus: (status: StreamStatus) => void
  setCanProcessQueue: (can: boolean) => void
  abortControllerRef: MutableRefObject<AbortController | null>
  isQueuePausedRef?: MutableRefObject<boolean>
  isProcessingQueueRef?: MutableRefObject<boolean>
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void
  setFocusedAgentId: (id: string | null) => void
  setInputFocused: (focused: boolean) => void
  setStreamingAgents: (updater: (prev: Set<string>) => Set<string>) => void
  setHasReceivedPlanResponse: (value: boolean) => void
  addSessionCredits: (credits: number) => void
  setRunState: (state: RunState | null) => void
  setIsRetrying: (value: boolean) => void
  previousRunStateRef: MutableRefObject<RunState | null>
  streamRefs: StreamController
  heartbeatIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>
  stalledWatcher: StalledResetWatcher
  updateChainInProgress: (value: boolean) => void
  addActiveSubagent: (id: string) => void
  removeActiveSubagent: (id: string) => void
  prepareUserMessage: (params: {
    content: string
    agentMode: AgentMode
    postUserMessage?: (prev: ChatMessage[]) => ChatMessage[]
    attachments?: PendingAttachment[]
  }) => Promise<{
    userMessageId: string
    messageContent: MessageContent[] | undefined
    bashContextForPrompt: string
    finalContent: string
  }>
  agentId?: string
  onBeforeMessageSend: () => Promise<{
    success: boolean
    errors: Array<{ id: string; message: string }>
  }>
  mainAgentTimer: ElapsedTimeTracker
  scrollToLatest: () => void
  onTimerEvent?: (event: SendMessageTimerEvent) => void
  resumeQueue?: () => void
  requeueMessageAtFront?: (message: {
    content: string
    attachments: PendingAttachment[]
  }) => void
}
