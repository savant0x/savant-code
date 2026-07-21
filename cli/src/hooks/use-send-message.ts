/* eslint-disable @typescript-eslint/no-explicit-any -- send message: dynamic action type shapes */
import { randomUUID } from 'node:crypto'

import { STATE_SNAPSHOT_INTERRUPTION_MESSAGE } from '@savant-code/sdk'
import { useCallback, useEffect, useRef } from 'react'

import { setCurrentChatId } from '../project-files'
import { createStreamController } from './stream-state'
import {
  getSavantFreeInstanceId,
  markSavantFreeSessionEnded,
} from './use-savant-free-session'
import { useChatStore } from '../state/chat-store'
import { getSelectedSavantFreeModel } from '../state/savant-free-model-store'
import {
  clearActiveRunAborter,
  setActiveRunAborter,
} from '../utils/active-run'
import { IS_SAVANT_FREE, getContextWindowForModel } from '../utils/constants'
import { createEventHandlerState } from '../utils/create-event-handler-state'
import { createRunConfig } from '../utils/create-run-config'
import { saveFidDocumentToDb, isFidPath } from '../utils/db-storage'
import {
  createStalledResetWatcher,
  markChunkSeen as markChunkSeenHelper,
  resetUiToIdle,
} from '../utils/finish-logic'
import { loadAgentDefinitions } from '../utils/local-agent-registry'
import { logger } from '../utils/logger'
import {
  clearLiveChatStateProvider,
  loadMostRecentChatState,
  resolveCurrentChatDir,
  saveChatState,
  scheduleCheckpointSave,
  setLiveChatStateProvider,
  settleCheckpointSave,
} from '../utils/run-state-storage'
import { getSavantCodeClient } from '../utils/savant-code-client'
import { getAgentIdForMode } from '../utils/savant-free-agent-selection'
import {
  autoCollapsePreviousMessages,
  createAiMessageShell,
  createErrorMessage as createErrorChatMessage,
  generateAiMessageId,
  sanitizeRestoredMessages,
} from '../utils/send-message-helpers'
import { createSendMessageTimerController } from '../utils/send-message-timer'
import { loadSavantCodeModelPreference } from '../utils/settings'
import {
  handleRunCompletion,
  handleRunError,
  prepareUserMessage as prepareUserMessageHelper,
  resetEarlyReturnState,
  setupStreamingContext,
} from './helpers/send-message'
import { isCoveredBySubscription } from '../utils/subscription'
import { yieldToEventLoop } from '../utils/yield-to-event-loop'

import type { ElapsedTimeTracker } from './use-elapsed-time'
import type { StreamStatus } from './use-message-queue'
import type { SubscriptionResponse } from './use-subscription-query'
import type { ChatMessage } from '../types/chat'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { PendingAttachment } from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { SendMessageTimerEvent } from '../utils/send-message-timer'
import type { AgentDefinition, MessageContent, RunState } from '@savant-code/sdk'

interface UseSendMessageOptions {
  inputRef: React.MutableRefObject<any>  
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
  subscriptionData?: SubscriptionResponse | null
}

// Choose the agent definition by explicit selection or mode-based fallback.
const resolveAgent = (
  agentMode: AgentMode,
  agentId: string | undefined,
  agentDefinitions: AgentDefinition[],
): AgentDefinition | string => {
  const selectedAgentDefinition =
    agentId && agentDefinitions.length > 0
      ? agentDefinitions.find((definition) => definition.id === agentId)
      : undefined

  return selectedAgentDefinition ?? agentId ?? getAgentIdForMode(agentMode)
}

// Apply the user's savant-code model override if one is set.
const applySavantCodeModelOverride = (
  agent: AgentDefinition | string,
  agentDefinitions: AgentDefinition[],
): AgentDefinition | string => {
  const modelOverride = loadSavantCodeModelPreference()
  if (!modelOverride) return agent

  // If agent is a string (agent ID), look it up
  const agentDef =
    typeof agent === 'string'
      ? agentDefinitions.find((def) => def.id === agent)
      : agent

  if (!agentDef) return agent

  // Only override if the model is actually different
  if (agentDef.model !== modelOverride) {
    return {
      ...agentDef,
      model: modelOverride,
    }
  }

  return agent
}

// Respect bash context, but avoid sending empty prompts when only images are attached.
const buildPromptWithContext = (
  promptWithBashContext: string,
  messageContent: MessageContent[] | undefined,
) => {
  const trimmedPrompt = promptWithBashContext.trim()
  if (trimmedPrompt.length > 0) {
    return promptWithBashContext
  }

  if (messageContent && messageContent.length > 0) {
    return 'See attached image(s)'
  }

  return ''
}

export const useSendMessage = ({
  inputRef,
  activeSubagentsRef,
  isChainInProgressRef,
  setStreamStatus,
  setCanProcessQueue,
  abortControllerRef,
  agentId,
  onBeforeMessageSend,
  mainAgentTimer,
  scrollToLatest,
  onTimerEvent = () => {},
  isQueuePausedRef,
  isProcessingQueueRef,
  resumeQueue,
  requeueMessageAtFront,
  continueChat,
  continueChatId,
  subscriptionData,
}: UseSendMessageOptions): {
  sendMessage: SendMessageFn
  clearMessages: () => void
} => {
  // Pull setters directly from store - these are stable references that don't need
  // to trigger re-renders, so using getState() outside of callbacks is intentional.
  const {
    setMessages,
    setFocusedAgentId,
    setInputFocused,
    setStreamingAgents,
    setActiveSubagents,
    setIsChainInProgress,
    setHasReceivedPlanResponse,
    setLastMessageMode,
    addSessionCredits,
    setRunState,
    setIsRetrying,
  } = useChatStore.getState()
  const previousRunStateRef = useRef<RunState | null>(
    useChatStore.getState().runState,
  )
  // Memoize stream controller to maintain referential stability across renders
  const streamRefsRef = useRef<ReturnType<
    typeof createStreamController
  > | null>(null)
  if (!streamRefsRef.current) {
    streamRefsRef.current = createStreamController()
  }
  const streamRefs = streamRefsRef.current

  // FID-2026-0718-010 (F3 + D5): heartbeat timer ref + stalled-state watcher.
  // Started before client.run, stopped in finally block. Heartbeat polls
  // the live snapshot every 2s for token counts; watcher polls every 5s
  // for 30s of chunk-silence + auto-reset.
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stalledWatcher = createStalledResetWatcher()

  useEffect(() => {
    if (continueChat && !previousRunStateRef.current) {
      const loadedState = loadMostRecentChatState(continueChatId ?? undefined)
      if (loadedState) {
        previousRunStateRef.current = loadedState.runState
        setRunState(loadedState.runState)
        setMessages(sanitizeRestoredMessages(loadedState.messages))
        if (loadedState.chatId) {
          setCurrentChatId(loadedState.chatId)
        }
      }
    }
  }, [continueChat, continueChatId, setMessages, setRunState])

  const updateChainInProgress = useCallback(
    (value: boolean) => {
      isChainInProgressRef.current = value
      setIsChainInProgress(value)
    },
    [setIsChainInProgress, isChainInProgressRef],
  )

  const updateActiveSubagents = useCallback(
    (mutate: (next: Set<string>) => void) => {
      setActiveSubagents((prev) => {
        const next = new Set(prev)
        mutate(next)
        activeSubagentsRef.current = next
        return next
      })
    },
    [setActiveSubagents, activeSubagentsRef],
  )

  const addActiveSubagent = useCallback(
    (subagentId: string) => {
      updateActiveSubagents((next) => next.add(subagentId))
    },
    [updateActiveSubagents],
  )

  const removeActiveSubagent = useCallback(
    (subagentId: string) => {
      updateActiveSubagents((next) => next.delete(subagentId))
    },
    [updateActiveSubagents],
  )

  function clearMessages() {
    previousRunStateRef.current = null
    setRunState(null)
  }

  const prepareUserMessage = useCallback(
    (params: {
      content: string
      agentMode: AgentMode
      postUserMessage?: (prev: ChatMessage[]) => ChatMessage[]
      attachments?: PendingAttachment[]
    }) => {
      // Access lastMessageMode fresh each call to get current value
      const { lastMessageMode } = useChatStore.getState()
      return prepareUserMessageHelper({
        ...params,
        deps: {
          setMessages,
          lastMessageMode,
          setLastMessageMode,
          scrollToLatest,
          setHasReceivedPlanResponse,
        },
      })
    },
    [
      setMessages,
      setLastMessageMode,
      scrollToLatest,
      setHasReceivedPlanResponse,
    ],
  )

  const sendMessage = useCallback<SendMessageFn>(
    async ({ content, agentMode, postUserMessage, attachments }) => {
      // CRITICAL: Set chain in progress immediately (synchronously) before any async work.
      // This ensures the router can detect that we're busy and queue subsequent messages.
      // Set the ref directly first to guarantee immediate visibility to other code paths,
      // then call updateChainInProgress to also update React state for re-renders.
      isChainInProgressRef.current = true
      updateChainInProgress(true)
      setCanProcessQueue(false)

      // SavantFree run-start guard: without a live session slot the server
      // rejects the request outright, consuming the message. Hold it at the
      // head of the queue instead; it resumes when the user rejoins from the
      // session-ended banner. Catches sends that bypass the queue's
      // sendBlocked hold (direct review-screen answers) and the dequeue race
      // where the slot expires between the queue's check and this call.
      if (IS_SAVANT_FREE && !getSavantFreeInstanceId()) {
        markSavantFreeSessionEnded()
        requeueMessageAtFront?.({ content, attachments: attachments ?? [] })
        resetEarlyReturnState({
          setCanProcessQueue,
          updateChainInProgress,
          isProcessingQueueRef,
          isQueuePausedRef,
        })
        return
      }

      setHasReceivedPlanResponse(false)

      // Initialize timer for elapsed time tracking
      const timerController = createSendMessageTimerController({
        mainAgentTimer,
        onTimerEvent,
        agentId,
      })
      setIsRetrying(false)

      // Prepare user message (bash context, images, text attachments, mode divider)
      let userMessageId: string
      let messageContent: MessageContent[] | undefined
      let bashContextForPrompt: string | undefined
      let finalContent: string

      try {
        const prepared = await prepareUserMessage({
          content,
          agentMode,
          postUserMessage,
          attachments,
        })
        userMessageId = prepared.userMessageId
        messageContent = prepared.messageContent
        bashContextForPrompt = prepared.bashContextForPrompt
        finalContent = prepared.finalContent
      } catch (error) {
        logger.error(
          { error },
          '[send-message] prepareUserMessage failed with exception',
        )
        setMessages((prev) => [
          ...prev,
          createErrorChatMessage(
            '⚠️ Failed to prepare message. Please try again.',
          ),
        ])
        resetEarlyReturnState({
          setCanProcessQueue,
          updateChainInProgress,
          isProcessingQueueRef,
          isQueuePausedRef,
        })
        return
      }

      // Validate before sending (e.g., agent config checks)
      try {
        const validationResult = await onBeforeMessageSend()

        if (!validationResult.success) {
          logger.warn(
            { errors: validationResult.errors },
            '[send-message] Validation failed',
          )
          const errorsToAttach =
            validationResult.errors.length === 0
              ? [
                  // Hide this for now, as validate endpoint may be flaky and we don't want to bother users.
                  // {
                  //   id: NETWORK_ERROR_ID,
                  //   message:
                  //     'Agent validation failed. This may be due to a network issue or temporary server problem. Please try again.',
                  // },
                ]
              : validationResult.errors

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== userMessageId) {
                return msg
              }
              return {
                ...msg,
                validationErrors: errorsToAttach,
              }
            }),
          )
          resetEarlyReturnState({
            setCanProcessQueue,
            updateChainInProgress,
            isProcessingQueueRef,
            isQueuePausedRef,
          })
          return
        }
      } catch (error) {
        logger.error(
          { error },
          '[send-message] Validation before message send failed with exception',
        )

        setMessages((prev) => [
          ...prev,
          createErrorChatMessage(
            '⚠️ Agent validation failed unexpectedly. Please try again.',
          ),
        ])
        await yieldToEventLoop()
        setTimeout(() => scrollToLatest(), 0)

        resetEarlyReturnState({
          setCanProcessQueue,
          updateChainInProgress,
          isProcessingQueueRef,
          isQueuePausedRef,
        })
        return
      }

      // Reset UI focus state
      setFocusedAgentId(null)
      setInputFocused(true)
      inputRef.current?.focus()

      // Reset FSM phase to idle on new user message (FID-2026-0718-008 Fix 9b)
      useChatStore.getState().onNewUserMessage()

      // Get SDK client
      const client = await getSavantCodeClient()

      if (!client) {
        logger.error(
          {},
          '[send-message] No SavantCode client available. Please ensure you are authenticated.',
        )
        // Show error to user instead of silently failing
        const brandName = IS_SAVANT_FREE ? 'SavantFree' : 'SavantCode'
        setMessages((prev) => [
          ...prev,
          createErrorChatMessage(
            `⚠️ Unable to connect to ${brandName}. Please check your authentication and try again.`,
          ),
        ])
        await yieldToEventLoop()
        setTimeout(() => scrollToLatest(), 0)
        resetEarlyReturnState({
          setCanProcessQueue,
          updateChainInProgress,
          isProcessingQueueRef,
          isQueuePausedRef,
        })
        return
      }

      // Create AI message shell and setup streaming context
      const aiMessageId = generateAiMessageId()
      const aiMessage = createAiMessageShell(aiMessageId)

      const { updater, hasReceivedContentRef, abortController } =
        setupStreamingContext({
          aiMessageId,
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
        })
      setStreamStatus('waiting')
      // Combine auto-collapse and AI message addition into single atomic update
      // to prevent flicker from intermediate render states
      setMessages((prev) => [
        ...autoCollapsePreviousMessages(prev, aiMessageId),
        aiMessage,
      ])
      // Note: updateChainInProgress(true) and setCanProcessQueue(false) are already
      // called at the start of sendMessage to ensure they happen synchronously
      // before any async work, so the router can correctly detect busy state.
      let actualCredits: number | undefined

      // Capture this run's chat directory once, up front. Every save for this
      // run targets this directory: the current chat id can rotate mid-run
      // (/new, resuming from /history), and resolving the dir at write time
      // would persist this run's state over a different chat's transcript.
      // After a switch the store's messages belong to the new conversation,
      // so persistence and state adoption below are gated on runChatIsCurrent.
      const runChatDir = resolveCurrentChatDir()
      const runChatIsCurrent = () => resolveCurrentChatDir() === runChatDir

      // Checkpoint the turn to disk immediately so that killing the process
      // (closed terminal, crash) can't lose the user's prompt, then keep the
      // checkpoint fresh from SDK run-state snapshots while the run streams.
      // The completion save below overwrites this with the final state.
      let latestRunStateSnapshot: RunState = previousRunStateRef.current ?? {
        traceSessionId: randomUUID(),
        output: {
          type: 'error',
          message: STATE_SNAPSHOT_INTERRUPTION_MESSAGE,
        },
      }
      setLiveChatStateProvider(aiMessageId, () => ({
        runState: latestRunStateSnapshot,
        messages: useChatStore.getState().messages,
      }))

      // Let chat switches abort this run so it can't keep streaming (and
      // persisting) for a conversation the user has left.
      setActiveRunAborter(aiMessageId, () => {
        // Already aborted (e.g. Esc, or a second chat switch): don't schedule
        // again — the store may hold the next conversation's messages by now.
        if (abortController.signal.aborted) {
          return
        }
        abortController.abort()
        // The abort listener has synchronously finalized the streaming
        // message (interruption notice + markComplete), and the caller is
        // about to switch away from this chat. Queue one final checkpoint of
        // that exact state: periodic checkpoints only cover up to ~5s ago,
        // and the post-run save below won't fire once the chat has switched.
        // scheduleCheckpointSave captures the messages array by reference, so
        // the store reset that follows the switch can't affect the write.
        scheduleCheckpointSave(
          latestRunStateSnapshot,
          useChatStore.getState().messages,
          runChatDir,
        )
      })
      saveChatState(
        latestRunStateSnapshot,
        useChatStore.getState().messages,
        runChatDir,
        getSelectedSavantFreeModel(),
      )

      // Execute SDK run with streaming handlers
      try {
        const agentDefinitions = loadAgentDefinitions()
        const resolvedAgent = resolveAgent(agentMode, agentId, agentDefinitions)
        const agentWithModelOverride = applySavantCodeModelOverride(
          resolvedAgent,
          agentDefinitions,
        )

        const promptWithBashContext = bashContextForPrompt
          ? bashContextForPrompt + finalContent
          : finalContent
        const effectivePrompt = buildPromptWithContext(
          promptWithBashContext,
          messageContent,
        )

        const eventHandlerState = createEventHandlerState({
          streamRefs,
          setStreamingAgents,
          setStreamStatus,
          aiMessageId,
          updater,
          hasReceivedContentRef,
          addActiveSubagent,
          removeActiveSubagent,
          agentMode,
          setHasReceivedPlanResponse,
          logger,
          setIsRetrying,
          onTotalCost: (cost: number) => {
            actualCredits = cost
            // Only add to session credits if not covered by subscription
            // (subscription credits are shown separately in the UI)
            if (!isCoveredBySubscription(subscriptionData)) {
              addSessionCredits(cost)
            }
            // Wire sidebar: update session cost
            useChatStore.getState().updateSessionCost(cost)
          },
          onToolCall: (toolName: string) => {
            // Wire sidebar: track tool usage and history
            useChatStore.getState().addToolUsed(toolName)
            useChatStore.getState().addToolHistory(toolName)
          },
          onSubagentStart: (agentId: string, displayName: string) => {
            // Wire sidebar: add agent to stack
            const current = useChatStore.getState().agentStack
            useChatStore.getState().updateAgentStack([
              ...current,
              { id: displayName, isActive: true },
            ])
          },
          onSubagentFinish: (agentId: string) => {
            // Wire sidebar: mark agent as inactive
            const current = useChatStore.getState().agentStack
            useChatStore.getState().updateAgentStack(
              current.map((a) =>
                a.id === agentId ? { ...a, isActive: false } : a,
              ),
            )
          },
        })

        const instanceId = getSavantFreeInstanceId()
        const runConfig = createRunConfig({
          logger,
          agent: agentWithModelOverride,
          prompt: effectivePrompt,
          content: messageContent,
          previousRunState: previousRunStateRef.current,
          agentDefinitions,
          eventHandlerState,
          signal: abortController.signal,
          extraSavantCodeMetadata:
            IS_SAVANT_FREE && instanceId
              ? { freebuff_instance_id: instanceId }
              : undefined,
          onStateSnapshot: (snapshot) => {
            latestRunStateSnapshot = snapshot

            // Wire sidebar: update context tokens and cost in real time
            // from periodic snapshots (~every 5s) so the UI stays current
            // during long runs, not just at completion.
            const snapshotTokenCount =
              snapshot?.sessionState?.mainAgentState?.contextTokenCount
            if (typeof snapshotTokenCount === 'number') {
              useChatStore.getState().updateContextTokens(snapshotTokenCount)
            }
            const snapshotCost =
              snapshot?.sessionState?.mainAgentState?.creditsUsed
            if (typeof snapshotCost === 'number') {
              useChatStore.getState().updateSessionCost(snapshotCost)
            }

            // Don't persist once the run is aborted or the user has switched
            // chats: the store's messages then belong to a different
            // conversation, and checkpointing them into this run's directory
            // would overwrite that chat's transcript with foreign (possibly
            // empty) state — the chat would then be hidden from /history.
            if (abortController.signal.aborted || !runChatIsCurrent()) {
              return
            }
            // Persist asynchronously and coalescing: the periodic snapshot
            // fires ~every 5s at step boundaries, and a synchronous save of the
            // (growing) transcript on the render/input thread is what stalls
            // long sessions. The authoritative synchronous saves below still
            // capture the final state.
            scheduleCheckpointSave(
              snapshot,
              useChatStore.getState().messages,
              runChatDir,
            )
          },
          onFileWritten: (params) => {
            // Save FID documents to database when written to disk
            if (isFidPath(params.path)) {
              saveFidDocumentToDb(params.path, params.content)
            }
            // Wire sidebar: track file changes
            useChatStore
              .getState()
              .incrementFilesChanged(
                params.type === 'modified' ? 'modified' : 'created',
              )
          },
          devMode: useChatStore.getState().devMode,
        })

        // Wire sidebar: add main agent to stack at run start
        const mainAgentName =
          typeof agentWithModelOverride === 'string'
            ? agentWithModelOverride
            : agentWithModelOverride.id
        useChatStore.getState().updateAgentStack([{ id: mainAgentName, isActive: true }])

        // Wire sidebar: set context window max from model
        const modelName =
          typeof agentWithModelOverride === 'string'
            ? undefined
            : agentWithModelOverride.model
        if (modelName) {
          useChatStore.getState().updateContextTokensMax(
            getContextWindowForModel(modelName),
          )
        }

        // Log a summary only: the full run config contains the entire
        // conversation history and attachments, which bloats log.jsonl.
        logger.info(
          {
            runConfig: {
              agent:
                typeof agentWithModelOverride === 'string'
                  ? agentWithModelOverride
                  : agentWithModelOverride.id,
              promptLength: effectivePrompt.length,
              contentBlockCount: messageContent?.length ?? 0,
              previousMessageCount:
                previousRunStateRef.current?.sessionState?.mainAgentState
                  .messageHistory.length ?? 0,
              agentDefinitionCount: agentDefinitions.length,
              maxAgentSteps: runConfig.maxAgentSteps,
            },
          },
          '[send-message] Sending message with sdk run config',
        )
        // FID-2026-0718-010 (F3): start heartbeat BEFORE client.run.
        // Polls latestRunStateSnapshot ref every 2s to keep the sidebar's
        // contextTokensUsed fresh during long sub-agent chains. The
        // snapshot ref is updated by onStateSnapshot above.
        heartbeatIntervalRef.current = setInterval(() => {
          const snap = latestRunStateSnapshot
          if (!snap) return
          // FID-2026-0718-010 (F3): poll token count every 2s. Cap is set
          // once at run-start from agentWithModelOverride.model; the
          // heartbeat intentionally does NOT refresh the cap (avoids the
          // cost-flicker problem called out in D4 if we extend to cost).
          const tokenCount =
            snap?.sessionState?.mainAgentState?.contextTokenCount
          if (typeof tokenCount === 'number') {
            useChatStore.getState().updateContextTokens(tokenCount)
          }
        }, 2_000)
        // Bump the chunk-seen watermark (FID-2026-0718-010 D5).
        markChunkSeenHelper('send-message-start')
        // Start the stalled-state watcher.
        stalledWatcher.start()

        const runState = await client.run(runConfig)

        // Only adopt and persist the result while this run's chat is still
        // the active one. After a mid-run chat switch (/new, resuming from
        // /history) the store's messages and run state belong to the new
        // conversation: saving here would overwrite it with this run's
        // context, and previousRunStateRef/setRunState would leak this run's
        // agent state into the other chat. (A plain Esc interrupt keeps the
        // same chat, so the interrupted turn is still saved as before.)
        if (runChatIsCurrent()) {
          // Finalize: persist state and mark complete
          previousRunStateRef.current = runState
          setRunState(runState)
          setIsRetrying(false)

          // Wire sidebar: update context tokens from agent state
          const contextTokenCount =
            runState?.sessionState?.mainAgentState?.contextTokenCount
          if (typeof contextTokenCount === 'number') {
            useChatStore.getState().updateContextTokens(contextTokenCount)
          }

          // Drop any queued/in-flight async checkpoint first so a stale write
          // can't land after this authoritative final save.
          await settleCheckpointSave()
          // Read committed state rather than saving inside a setMessages
          // updater: the store uses immer, so the updater sees a draft proxy
          // and JSON.stringify of the (unbounded) transcript through proxy
          // traps is several times slower.
          saveChatState(runState, useChatStore.getState().messages, runChatDir, getSelectedSavantFreeModel())
        }
        handleRunCompletion({
          runState,
          actualCredits,
          agentMode,
          timerController,
          updater,
          aiMessageId,
          wasAbortedByUser: abortController.signal.aborted,
          hasReceivedContent: hasReceivedContentRef.current,
          setStreamStatus,
          setCanProcessQueue,
          updateChainInProgress,
          setHasReceivedPlanResponse,
          resumeQueue,
          isProcessingQueueRef,
          isQueuePausedRef,
        })
      } catch (error) {
        // If this run was aborted, the abort handler already handled cleanup.
        // Don't run error handling to avoid interfering with any new run that
        // may have started. Uses per-run abortController.signal (not shared
        // streamRefs) so a newer run's reset() can't clear this flag.
        if (!abortController.signal.aborted) {
          handleRunError({
            error,
            timerController,
            updater,
            setIsRetrying,
            setStreamStatus,
            setCanProcessQueue,
            updateChainInProgress,
            isProcessingQueueRef,
            isQueuePausedRef,
            hasReceivedContent: hasReceivedContentRef.current,
          })
          // Persist the last checkpoint plus the error banner so a restart
          // after a failed run still shows this turn. Settle async checkpoints
          // first so a stale write can't clobber this one. Skipped after a
          // mid-run chat switch — the store's messages belong to the new chat.
          if (runChatIsCurrent()) {
            await settleCheckpointSave()
            saveChatState(
              latestRunStateSnapshot,
              useChatStore.getState().messages,
              runChatDir,
              getSelectedSavantFreeModel(),
            )
          }
        } else {
          logger.debug({ error }, '[send-message] Ignoring error after abort')
        }
      } finally {
        // FID-2026-0718-010 (F2 + Q14): BEFORE clearing live state provider,
        // mark the run as completed so late-arriving chunks short-circuit.
        // Then fire the canonical end-of-stream reset. Order matters — the
        // snapshot must settle first, then the UI resets to idle.
        streamRefs.setters.setRunCompleted(true)
        if (!abortController.signal.aborted) {
          // Normal completion path: fire the canonical reset.
          useChatStore.getState().onStreamEnded('finish')
        } else {
          // Abort path: skip chain-lock release here (abort handler did it),
          // still reset FSM phase + activity to idle.
          resetUiToIdle('abort', { force: true })
        }

        // Stop the heartbeat + stalled watcher (FID-2026-0718-010 F3/D5).
        // Belt-and-braces: clear both named timers even if a previous run
        // didn't clean up. Idempotent — clearInterval/setTimeout nulls are
        // safe to call repeatedly.
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
        stalledWatcher.stop()

        // Stop exit-flushing this run's checkpoint; the final state (or last
        // checkpoint, on error) has been saved above. Owner-guarded so an
        // aborted run resolving late can't clear a newer run's provider.
        clearLiveChatStateProvider(aiMessageId)
        clearActiveRunAborter(aiMessageId)
        // If this run was aborted, the abort handler already released the chain lock
        // and queue processing state. Don't touch shared state here to avoid
        // interfering with any new run that may have started after the abort.
        // Uses per-run abortController.signal (not shared streamRefs) so a newer
        // run's reset() can't clear this flag.
        if (!abortController.signal.aborted) {
          if (isChainInProgressRef.current) {
            logger.warn(
              {},
              '[send-message] Chain still in progress after try/catch, forcing reset',
            )
            updateChainInProgress(false)
            setStreamStatus('idle')
            setCanProcessQueue(!isQueuePausedRef?.current)
          }
          // Safety net: ensure lock is always released even if handleRunCompletion/handleRunError
          // didn't run (e.g., due to unexpected early return). Redundant releases are safe (idempotent).
          if (isProcessingQueueRef) {
            isProcessingQueueRef.current = false
          }
        }
        updater.dispose()
      }
    },
    [
      addActiveSubagent,
      addSessionCredits,
      agentId,
      inputRef,
      isChainInProgressRef,
      isProcessingQueueRef,
      isQueuePausedRef,
      mainAgentTimer,
      onBeforeMessageSend,
      onTimerEvent,
      prepareUserMessage,
      removeActiveSubagent,
      requeueMessageAtFront,
      resumeQueue,
      scrollToLatest,
      setCanProcessQueue,
      setFocusedAgentId,
      setHasReceivedPlanResponse,
      setInputFocused,
      setIsRetrying,
      setMessages,
      setRunState,
      setStreamStatus,
      setStreamingAgents,
      streamRefs,
      updateChainInProgress,
    ],
  )

  return {
    sendMessage,
    clearMessages,
  }
}
